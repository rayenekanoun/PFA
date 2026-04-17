import { connect, type IClientOptions, type MqttClient } from "mqtt";
import { loadConfig } from "./config";
import {
  buildCapabilityErrorResponse,
  buildDiagnosticErrorResponse,
  CapabilityResponseSchema,
  capabilityResponseTopicForDevice,
  DiagnosticResponseSchema,
  diagnosticResponseTopicForDevice,
  parseCapabilityCommandFromPayload,
  parseDiagnosticCommandFromPayload,
} from "./contracts";
import { RequestDedupeCache } from "./dedupe";
import { buildCapabilityScenarioOutcome, buildDiagnosticScenarioOutcome } from "./scenario";

const DIAGNOSTIC_REQUEST_TOPIC_REGEX = /^devices\/([^/]+)\/commands\/diagnostic\/request$/;
const CAPABILITY_REQUEST_TOPIC_REGEX = /^devices\/([^/]+)\/commands\/capabilities\/request$/;

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const dedupeCache = new RequestDedupeCache(config.duplicateTtlMs);

  const clientOptions: IClientOptions = {
    servers: config.mqttServers,
    clientId: config.clientId,
    clean: true,
    reconnectPeriod: config.reconnectPeriodMs,
    connectTimeout: config.connectTimeoutMs,
  };

  const client = connect(clientOptions);

  client.on("connect", () => {
    logInfo(
      `Connected as '${config.clientId}' to ${formatServers(config.mqttServers)}. Subscribing to '${config.requestTopic}' with qos=${config.requestQos}.`,
    );

    client.subscribe(config.requestTopic, { qos: config.requestQos }, (error, granted) => {
      if (error) {
        logError(`Subscription failed: ${error.message}`);
        return;
      }

      const grantedSummary = (granted ?? [])
        .map((entry) => `${entry.topic} (qos=${entry.qos})`)
        .join(", ");
      logInfo(`Subscription active: ${grantedSummary}`);
    });
  });

  client.on("message", (topic, payloadBuffer) => {
    const payloadText = payloadBuffer.toString("utf8");
    void handleMessage(client, topic, payloadText, {
      responseQos: config.responseQos,
      maxDelayMs: config.maxDelayMs,
      dedupeCache,
    });
  });

  client.on("reconnect", () => {
    logInfo("Reconnecting to MQTT broker cluster...");
  });

  client.on("offline", () => {
    logInfo("MQTT client is offline.");
  });

  client.on("error", (error) => {
    logError(`MQTT error: ${error.message}`);
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logInfo(`Received ${signal}; closing simulator.`);
    client.end(true, () => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

interface HandleMessageOptions {
  responseQos: 0 | 1 | 2;
  maxDelayMs: number;
  dedupeCache: RequestDedupeCache;
}

async function handleMessage(
  client: MqttClient,
  topic: string,
  payloadText: string,
  options: HandleMessageOptions,
): Promise<void> {
  const diagnosticDeviceId = extractDeviceId(topic, DIAGNOSTIC_REQUEST_TOPIC_REGEX);
  if (diagnosticDeviceId) {
    await handleDiagnosticMessage(client, topic, payloadText, diagnosticDeviceId, options);
    return;
  }

  const capabilityDeviceId = extractDeviceId(topic, CAPABILITY_REQUEST_TOPIC_REGEX);
  if (capabilityDeviceId) {
    await handleCapabilityMessage(client, topic, payloadText, capabilityDeviceId, options);
  }
}

async function handleDiagnosticMessage(
  client: MqttClient,
  topic: string,
  payloadText: string,
  topicDeviceId: string,
  options: HandleMessageOptions,
): Promise<void> {
  const parsed = parseDiagnosticCommandFromPayload(payloadText, topicDeviceId);
  if (!parsed.ok) {
    logInfo(`Invalid diagnostic request on topic '${topic}': ${parsed.reason}`);
    const errorResponse = buildDiagnosticErrorResponse({
      requestId: parsed.requestId,
      deviceId: parsed.deviceId,
      carId: parsed.carId,
      generatedAt: new Date().toISOString(),
      code: "INVALID_REQUEST",
      message: parsed.reason,
    });
    await publishDiagnosticResponse(client, parsed.deviceId, errorResponse, options.responseQos);
    return;
  }

  const dedupeKey = `diagnostic:${parsed.command.requestId}`;
  if (!options.dedupeCache.markIfNew(dedupeKey)) {
    logInfo(`Duplicate diagnostic request ignored: requestId='${parsed.command.requestId}', carId='${parsed.command.carId}'.`);
    return;
  }

  const outcome = buildDiagnosticScenarioOutcome(parsed.command, new Date(), {
    maxDelayMs: options.maxDelayMs,
  });

  if (outcome.kind === "silent") {
    logInfo(`Timeout mode selected for requestId='${parsed.command.requestId}'. No diagnostic response will be published.`);
    return;
  }

  if (outcome.delayMs > 0) {
    await sleep(outcome.delayMs);
  }

  await publishDiagnosticResponse(client, parsed.command.deviceId, outcome.response, options.responseQos);
}

async function handleCapabilityMessage(
  client: MqttClient,
  topic: string,
  payloadText: string,
  topicDeviceId: string,
  options: HandleMessageOptions,
): Promise<void> {
  const parsed = parseCapabilityCommandFromPayload(payloadText, topicDeviceId);
  if (!parsed.ok) {
    logInfo(`Invalid capability request on topic '${topic}': ${parsed.reason}`);
    const errorResponse = buildCapabilityErrorResponse({
      requestId: parsed.requestId,
      deviceId: parsed.deviceId,
      carId: parsed.carId,
      generatedAt: new Date().toISOString(),
      supportWindows: ["0100", "0120", "0140"],
      code: "INVALID_REQUEST",
      message: parsed.reason,
    });
    await publishCapabilityResponse(client, parsed.deviceId, errorResponse, options.responseQos);
    return;
  }

  const dedupeKey = `capability:${parsed.command.requestId}`;
  if (!options.dedupeCache.markIfNew(dedupeKey)) {
    logInfo(`Duplicate capability request ignored: requestId='${parsed.command.requestId}', carId='${parsed.command.carId}'.`);
    return;
  }

  const outcome = buildCapabilityScenarioOutcome(parsed.command, new Date());
  if (outcome.kind === "silent") {
    return;
  }
  await publishCapabilityResponse(client, parsed.command.deviceId, outcome.response, options.responseQos);
}

async function publishDiagnosticResponse(
  client: MqttClient,
  deviceId: string,
  payload: unknown,
  qos: 0 | 1 | 2,
): Promise<void> {
  const validatedPayload = DiagnosticResponseSchema.parse(payload);
  const topic = diagnosticResponseTopicForDevice(deviceId);
  const payloadText = JSON.stringify(validatedPayload);

  await publish(client, topic, payloadText, qos);
  logInfo(`Published diagnostic response to '${topic}' for requestId='${validatedPayload.requestId}' with status='${validatedPayload.status}'.`);
}

async function publishCapabilityResponse(
  client: MqttClient,
  deviceId: string,
  payload: unknown,
  qos: 0 | 1 | 2,
): Promise<void> {
  const validatedPayload = CapabilityResponseSchema.parse(payload);
  const topic = capabilityResponseTopicForDevice(deviceId);
  const payloadText = JSON.stringify(validatedPayload);

  await publish(client, topic, payloadText, qos);
  logInfo(`Published capability response to '${topic}' for requestId='${validatedPayload.requestId}' with status='${validatedPayload.status}'.`);
}

async function publish(
  client: MqttClient,
  topic: string,
  payloadText: string,
  qos: 0 | 1 | 2,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    client.publish(topic, payloadText, { qos }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function extractDeviceId(topic: string, regex: RegExp): string | null {
  const match = topic.match(regex);
  return match?.[1] ?? null;
}

function formatServers(servers: Array<{ host: string; port: number }>): string {
  return servers.map((server) => `${server.host}:${server.port}`).join(", ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function logInfo(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [simulator] ${message}`);
}

function logError(message: string): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [simulator] ${message}`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  logError(`Fatal startup error: ${message}`);
  process.exit(1);
});
