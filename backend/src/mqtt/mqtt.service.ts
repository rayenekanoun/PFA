import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type IClientOptions, type MqttClient } from 'mqtt';
import {
  capabilityDiscoveryResponseSchema,
  diagnosticDeviceResponseSchema,
  type CapabilityDiscoveryResponse,
  type DiagnosticDeviceResponse,
  type PublishCapabilityDiscoveryInput,
  type PublishDiagnosticCommandInput,
} from './mqtt.contracts';

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  timer: NodeJS.Timeout;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient | null = null;
  private connectedPromise: Promise<void> | null = null;
  private readonly pendingDiagnostics = new Map<string, PendingRequest<DiagnosticDeviceResponse>>();
  private readonly pendingCapabilities = new Map<string, PendingRequest<CapabilityDiscoveryResponse>>();

  public constructor(private readonly configService: ConfigService) {}

  public async onModuleInit(): Promise<void> {
    await this.connectClient();
  }

  public async onModuleDestroy(): Promise<void> {
    for (const pending of this.pendingDiagnostics.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('MQTT service is shutting down.'));
    }
    for (const pending of this.pendingCapabilities.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('MQTT service is shutting down.'));
    }

    this.pendingDiagnostics.clear();
    this.pendingCapabilities.clear();

    if (!this.client) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.client?.end(true, {}, () => resolve());
    });
  }

  public async publishDiagnosticCommand(
    input: PublishDiagnosticCommandInput,
  ): Promise<DiagnosticDeviceResponse> {
    await this.ensureConnected();
    const topic = `cars/${input.carId}/commands/diagnostic/request`;
    const payload = {
      requestId: input.requestId,
      planId: input.planId,
      carId: input.carId,
      type: 'diagnostic',
      correlationId: input.correlationId,
      includeDtcs: input.includeDtcs,
      timeoutMs: input.timeoutMs,
      pids: input.pids,
      ...(input.simulate ? { simulate: input.simulate } : {}),
    };

    return this.publishAndAwait({
      topic,
      requestId: input.requestId,
      payload,
      map: this.pendingDiagnostics,
      timeoutMs: input.timeoutMs,
    });
  }

  public async publishCapabilityDiscovery(
    input: PublishCapabilityDiscoveryInput,
  ): Promise<CapabilityDiscoveryResponse> {
    await this.ensureConnected();
    const topic = `cars/${input.carId}/commands/capabilities/request`;
    const payload = {
      requestId: input.requestId,
      carId: input.carId,
      type: 'capability_discovery',
      correlationId: input.correlationId,
      supportWindows: input.supportWindows,
    };

    return this.publishAndAwait({
      topic,
      requestId: input.requestId,
      payload,
      map: this.pendingCapabilities,
      timeoutMs: this.configService.get<number>('MQTT_REQUEST_TIMEOUT_MS', 15000),
    });
  }

  private async connectClient(): Promise<void> {
    if (this.connectedPromise) {
      return this.connectedPromise;
    }

    const servers = this.parseServers();
    const clientOptions: IClientOptions = {
      servers,
      clientId: `${this.configService.get<string>('MQTT_CLIENT_ID', 'diagnostic-backend')}-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 10000,
    };

    this.client = connect(clientOptions);
    this.client.on('message', (topic, payloadBuffer) => {
      this.handleMessage(topic, payloadBuffer.toString('utf8'));
    });
    this.client.on('reconnect', () => {
      this.logger.log('Reconnecting to MQTT cluster...');
    });
    this.client.on('offline', () => {
      this.logger.warn('MQTT client is offline.');
    });
    this.client.on('error', (error) => {
      this.logger.error(`MQTT client error: ${error.message}`);
    });

    this.connectedPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      this.client?.once('connect', () => {
        void this.subscribeToResponseTopics()
          .then(() => {
            settled = true;
            this.logger.log('Connected to MQTT cluster and subscribed to response topics.');
            resolve();
          })
          .catch((error) => {
            settled = true;
            reject(error);
          });
      });

      this.client?.once('error', (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
    });

    return this.connectedPromise;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connectedPromise) {
      await this.connectClient();
      return;
    }

    await this.connectedPromise;
  }

  private async subscribeToResponseTopics(): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT client is not initialized.');
    }

    await Promise.all([
      this.subscribe('cars/+/telemetry/diagnostic/response'),
      this.subscribe('cars/+/telemetry/capabilities/response'),
    ]);
  }

  private subscribe(topic: string): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT client is not initialized.');
    }

    return new Promise<void>((resolve, reject) => {
      this.client?.subscribe(topic, { qos: 2 }, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private handleMessage(topic: string, payloadText: string): void {
    try {
      const payload = JSON.parse(payloadText) as unknown;

      if (topic.includes('/telemetry/diagnostic/response')) {
        const parsed = diagnosticDeviceResponseSchema.safeParse(payload);
        if (!parsed.success) {
          this.logger.warn(`Ignoring invalid diagnostic response payload on ${topic}.`);
          return;
        }

        const pending = this.pendingDiagnostics.get(parsed.data.requestId);
        if (!pending) {
          this.logger.warn(`No pending diagnostic request found for requestId='${parsed.data.requestId}'.`);
          return;
        }

        clearTimeout(pending.timer);
        this.pendingDiagnostics.delete(parsed.data.requestId);
        pending.resolve(parsed.data);
        return;
      }

      if (topic.includes('/telemetry/capabilities/response')) {
        const parsed = capabilityDiscoveryResponseSchema.safeParse(payload);
        if (!parsed.success) {
          this.logger.warn(`Ignoring invalid capability response payload on ${topic}.`);
          return;
        }

        const pending = this.pendingCapabilities.get(parsed.data.requestId);
        if (!pending) {
          this.logger.warn(`No pending capability discovery request found for requestId='${parsed.data.requestId}'.`);
          return;
        }

        clearTimeout(pending.timer);
        this.pendingCapabilities.delete(parsed.data.requestId);
        pending.resolve(parsed.data);
      }
    } catch (error) {
      this.logger.warn(
        `Ignoring unreadable MQTT payload on topic '${topic}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private publishAndAwait<T>(input: {
    topic: string;
    requestId: string;
    payload: Record<string, unknown>;
    map: Map<string, PendingRequest<T>>;
    timeoutMs: number;
  }): Promise<T> {
    if (!this.client) {
      throw new Error('MQTT client is not initialized.');
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        input.map.delete(input.requestId);
        reject(new Error(`Timed out waiting for MQTT response for request '${input.requestId}'.`));
      }, input.timeoutMs);

      input.map.set(input.requestId, {
        resolve,
        reject,
        timer,
      });

      this.client?.publish(input.topic, JSON.stringify(input.payload), { qos: 2 }, (error) => {
        if (error) {
          clearTimeout(timer);
          input.map.delete(input.requestId);
          reject(error);
        }
      });
    });
  }

  private parseServers(): Array<{ host: string; port: number }> {
    const raw = this.configService.get<string>('MQTT_SERVERS', 'localhost:1883');
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const [host, port] = value.split(':');
        return {
          host,
          port: Number(port || 1883),
        };
      });
  }
}
