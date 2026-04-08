# MQTT Diagnostic Simulator

Deterministic TypeScript simulator for the local EMQX cluster.

## Supported command contract

- Subscribe topic: `cars/{carId}/commands/#` (`qos=2`)
- Diagnostic response topic: `cars/{carId}/telemetry/diagnostic/response` (`qos=2`)
- Capability response topic: `cars/{carId}/telemetry/capabilities/response` (`qos=2`)
- Supported command types:
  - `diagnostic`
  - `capability_discovery`
- Diagnostic modes: `success`, `delay`, `error`, `timeout`

Diagnostic command shape:

```json
{
  "requestId": "req-123",
  "planId": "plan-123",
  "carId": "demo",
  "type": "diagnostic",
  "correlationId": "corr-123",
  "includeDtcs": true,
  "timeoutMs": 15000,
  "pids": [
    { "key": "engine_rpm", "mode": "01", "pid": "0C" },
    { "key": "vehicle_speed", "mode": "01", "pid": "0D" }
  ],
  "simulate": { "mode": "success" }
}
```

Capability discovery command shape:

```json
{
  "requestId": "cap-123",
  "carId": "demo",
  "type": "capability_discovery",
  "correlationId": "cap-corr-123",
  "supportWindows": ["0100", "0120", "0140"]
}
```

## Local run

```powershell
cd .\infra\mqtt-cluster\simulator
npm install
npm run test
npm run build
npm run start
```

For live broker connection from local host, defaults target:

- `localhost:1883`
- `localhost:2883`
- `localhost:3883`

## Environment variables

- `MQTT_SERVERS` (default: `localhost:1883,localhost:2883,localhost:3883`)
- `REQUEST_TOPIC` (default: `cars/+/commands/#`)
- `REQUEST_QOS` (default: `2`)
- `RESPONSE_QOS` (default: `2`)
- `MAX_DELAY_MS` (default: `30000`)
- `DUPLICATE_TTL_MS` (default: `300000`)
- `MQTT_CONNECT_TIMEOUT_MS` (default: `10000`)
- `MQTT_RECONNECT_PERIOD_MS` (default: `1000`)
- `MQTT_CLIENT_ID` (default: auto-generated)

## What the simulator is used for

The backend relies on the simulator for local verification of:

- vehicle capability discovery
- filtered PID planning against `vehicle_supported_pids`
- diagnostic success, delay, error, and timeout flows
- correlated request/response handling over the EMQX cluster
