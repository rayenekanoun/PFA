export type QosLevel = 0 | 1 | 2;

export interface MqttServer {
  host: string;
  port: number;
}

export interface SimulatorConfig {
  mqttServers: MqttServer[];
  requestTopic: string;
  requestQos: QosLevel;
  responseQos: QosLevel;
  maxDelayMs: number;
  duplicateTtlMs: number;
  connectTimeoutMs: number;
  reconnectPeriodMs: number;
  clientId: string;
}

const DEFAULT_TOPIC = "cars/+/commands/#";
const DEFAULT_SERVERS = "localhost:1883,localhost:2883,localhost:3883";

export function loadConfig(env: NodeJS.ProcessEnv): SimulatorConfig {
  const requestQos = parseQosLevel(env.REQUEST_QOS, "REQUEST_QOS", 2);
  const responseQos = parseQosLevel(env.RESPONSE_QOS, "RESPONSE_QOS", 2);

  return {
    mqttServers: parseServers(env.MQTT_SERVERS ?? DEFAULT_SERVERS),
    requestTopic: env.REQUEST_TOPIC ?? DEFAULT_TOPIC,
    requestQos,
    responseQos,
    maxDelayMs: parseIntRange(env.MAX_DELAY_MS, "MAX_DELAY_MS", 30_000, 1, 60_000),
    duplicateTtlMs: parseIntRange(
      env.DUPLICATE_TTL_MS,
      "DUPLICATE_TTL_MS",
      300_000,
      1_000,
      3_600_000,
    ),
    connectTimeoutMs: parseIntRange(
      env.MQTT_CONNECT_TIMEOUT_MS,
      "MQTT_CONNECT_TIMEOUT_MS",
      10_000,
      1_000,
      60_000,
    ),
    reconnectPeriodMs: parseIntRange(
      env.MQTT_RECONNECT_PERIOD_MS,
      "MQTT_RECONNECT_PERIOD_MS",
      1_000,
      100,
      30_000,
    ),
    clientId: env.MQTT_CLIENT_ID ?? `diag-simulator-${Math.floor(Math.random() * 1_000_000)}`,
  };
}

function parseServers(input: string): MqttServer[] {
  const pairs = input
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (pairs.length === 0) {
    throw new Error("MQTT_SERVERS must include at least one host:port pair.");
  }

  return pairs.map((pair) => {
    const [host, portRaw] = pair.split(":");
    if (!host || !portRaw) {
      throw new Error(`Invalid server entry '${pair}'. Expected host:port.`);
    }

    const port = Number(portRaw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port in MQTT_SERVERS entry '${pair}'.`);
    }

    return {
      host,
      port,
    };
  });
}

function parseIntRange(
  rawValue: string | undefined,
  envVarName: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (rawValue === undefined || rawValue.length === 0) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${envVarName} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
}

function parseQosLevel(rawValue: string | undefined, envVarName: string, fallback: QosLevel): QosLevel {
  if (rawValue === undefined || rawValue.length === 0) {
    return fallback;
  }

  if (rawValue !== "0" && rawValue !== "1" && rawValue !== "2") {
    throw new Error(`${envVarName} must be one of: 0, 1, 2.`);
  }

  return Number(rawValue) as QosLevel;
}
