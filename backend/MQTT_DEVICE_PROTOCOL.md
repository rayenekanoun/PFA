# MQTT Device Protocol Guide

This document explains how a real OBD device should talk to the backend over MQTT.

It is written for someone building the device side from scratch.

The goal is simple:

- the backend sends MQTT requests to a device associated with a given `carId`
- the device listens on the correct MQTT topics
- the device queries the real OBD interface / CAN bus / ELM327 adapter
- the device responds in the JSON format the backend expects

If the device follows this document, it can replace the simulator and work with the backend directly.

## Big Picture

The backend currently uses two kinds of MQTT requests:

1. capability discovery
2. diagnostic execution

Capability discovery is used to learn what the car supports.

Diagnostic execution is used to request actual live PID values and optionally DTCs.

The backend decides when to do each one:

- if supported PIDs for a vehicle are missing or stale, the backend first triggers capability discovery
- once support is known, the backend sends a diagnostic request with only the requested PIDs

The device does not need to decide this itself.
It only needs to:

- subscribe to the right MQTT topics
- parse the request
- query the vehicle
- publish the right response JSON

## Question: For the device, from where should it subscribe?

The device should subscribe to these MQTT request topics for its own `carId`:

- Diagnostic requests:
  - `cars/{carId}/commands/diagnostic/request`
- Capability discovery requests:
  - `cars/{carId}/commands/capabilities/request`

Example for a car with `carId = my-car-001`:

- `cars/my-car-001/commands/diagnostic/request`
- `cars/my-car-001/commands/capabilities/request`

This means each physical device should know which `carId` it is representing on MQTT.

## Question: What format should it respond in?

The device should respond with JSON over MQTT.

The backend expects:

- UTF-8 JSON payload
- one response per request
- the same `requestId` echoed back
- the same `carId` echoed back
- ISO timestamp in `generatedAt`

The response topics are:

- Diagnostic responses:
  - `cars/{carId}/telemetry/diagnostic/response`
- Capability discovery responses:
  - `cars/{carId}/telemetry/capabilities/response`

## Question: If supported PIDs are not stored yet, should we request them first?

Yes.

The backend already does this automatically before diagnostics when supported PIDs are missing or stale.

The device does not need to decide that logic. The backend does it.

When the backend wants full capability discovery, it sends support-mask queries for all currently relevant mask-based windows from the project reference/catalog:

- `0100`
- `0120`
- `0140`
- `0160`
- `0200`
- `0500`
- `0600`
- `0900`

Important clarification:

- `03` is not a support-mask query
- `03` means "read stored DTCs"
- similarly, `07` and `0A` are DTC retrieval modes, not support-bitmask windows

So if you want "everything the car supports", the device should answer the bitmask windows above, then the backend can infer the actual supported PIDs from them.

## Question: Are capability requests on the same topic / same structure?

Same car namespace, different topic.

Request topic:

- `cars/{carId}/commands/capabilities/request`

Response topic:

- `cars/{carId}/telemetry/capabilities/response`

The shape is similar to diagnostic requests, but simpler.

## Question: What is the capability discovery request structure?

Example request:

```json
{
  "requestId": "cap-vehicleId-timestamp",
  "carId": "your-car-id",
  "type": "capability_discovery",
  "correlationId": "device-or-run-id",
  "supportWindows": ["0100", "0120", "0140", "0160", "0200", "0500", "0600", "0900"]
}
```

Field meaning:

- `requestId`
  - unique backend request identifier
  - must be echoed back in the response
- `carId`
  - MQTT car identifier used by the backend
  - must be echoed back in the response
- `type`
  - always `capability_discovery` for this request type
- `correlationId`
  - backend correlation field
  - useful for tracing/logging on the device
- `supportWindows`
  - the bitmask-style OBD queries the device should run to detect what is supported

## Question: What should the device actually do during capability discovery?

For each value in `supportWindows`, the device should query the real OBD interface.

Examples:

- `0100` asks which Mode 01 PIDs in range `01-20` are supported
- `0120` asks which Mode 01 PIDs in range `21-40` are supported
- `0140` asks which Mode 01 PIDs in range `41-60` are supported
- `0160` asks which Mode 01 PIDs in range `61-80` are supported
- `0200` asks which freeze-frame PIDs are supported
- `0500` asks which Mode 05 O2 test PIDs are supported
- `0600` asks which Mode 06 onboard monitor test IDs are supported
- `0900` asks which Mode 09 information PIDs are supported

The device must decode those support bitmasks and produce the list of actual supported OBD full codes.

That means the response should contain real codes such as:

- `010C`
- `010D`
- `0105`
- `0902`
- `0501`
- `0601`

and not only the mask windows themselves.

## Question: What is the capability discovery response structure?

Successful example:

```json
{
  "requestId": "cap-vehicleId-timestamp",
  "carId": "your-car-id",
  "generatedAt": "2026-04-16T16:46:00.000Z",
  "status": "ok",
  "supportedPidCodes": ["010C", "010D", "0105", "0121", "0142", "0204", "0501", "0601", "0902"],
  "supportWindows": ["0100", "0120", "0140", "0160", "0200", "0500", "0600", "0900"]
}
```

Failure example:

```json
{
  "requestId": "cap-vehicleId-timestamp",
  "carId": "your-car-id",
  "generatedAt": "2026-04-16T16:46:00.000Z",
  "status": "error",
  "supportedPidCodes": [],
  "supportWindows": ["0100", "0120", "0140", "0160", "0200", "0500", "0600", "0900"],
  "error": {
    "code": "OBD_TIMEOUT",
    "message": "Adapter did not respond"
  }
}
```

Field meaning:

- `generatedAt`
  - ISO datetime string
- `status`
  - `ok` or `error`
- `supportedPidCodes`
  - final flattened list of actual supported OBD full codes
  - this is what the backend stores and uses later
- `supportWindows`
  - echo back what was requested
- `error`
  - only present when `status = error`

## Question: What is the diagnostic request structure?

Example:

```json
{
  "requestId": "diagnostic-request-id",
  "planId": "diagnostic-plan-id",
  "carId": "your-car-id",
  "type": "diagnostic",
  "correlationId": "run-id",
  "includeDtcs": true,
  "timeoutMs": 15000,
  "pids": [
    { "key": "engine_rpm", "mode": "01", "pid": "0C" },
    { "key": "vehicle_speed", "mode": "01", "pid": "0D" }
  ]
}
```

Field meaning:

- `requestId`
  - unique backend request id
  - must be echoed back in the response
- `planId`
  - backend plan identifier
  - should be echoed back when possible
- `carId`
  - MQTT car identifier
- `type`
  - always `diagnostic`
- `correlationId`
  - backend correlation id for tracing
- `includeDtcs`
  - whether DTC data should also be returned
- `timeoutMs`
  - max backend wait time
- `pids`
  - exact PID list the device should query
  - each entry gives:
    - `key`: backend semantic name
    - `mode`: OBD mode like `01`
    - `pid`: OBD PID like `0C`

## Question: How should the device send requested PID data back?

The backend expects JSON with typed decoded values.

Best practice:

- `raw`
  - raw hex/string from the adapter
- `decoded`
  - usable normalized value

This is strongly recommended because:

- `raw` helps debugging low-level issues
- `decoded` lets the backend and AI work directly with usable values

Example success response:

```json
{
  "requestId": "diagnostic-request-id",
  "planId": "diagnostic-plan-id",
  "carId": "your-car-id",
  "generatedAt": "2026-04-16T16:46:00.000Z",
  "status": "ok",
  "measurements": [
    {
      "mode": "01",
      "pid": "0C",
      "key": "engine_rpm",
      "label": "Engine RPM",
      "unit": "RPM",
      "status": "ok",
      "raw": "1AF8",
      "decoded": 1726
    },
    {
      "mode": "01",
      "pid": "0D",
      "key": "vehicle_speed",
      "label": "Vehicle speed",
      "unit": "km/h",
      "status": "ok",
      "raw": "3C",
      "decoded": 60
    }
  ],
  "dtcs": []
}
```

## Question: Is it hex, string, or what?

The backend is not expecting hex-only.

Best practice is:

- `raw`: the raw adapter/OBD value as hex or string
- `decoded`: the normalized typed value

Examples:

- RPM:
  - `raw = "1AF8"`
  - `decoded = 1726`
- Coolant temperature:
  - `raw = "5A"`
  - `decoded = 50`
- VIN:
  - `raw = "57 50 30 5A 5A 5A ..."`
  - `decoded = "WP0ZZZ..."`

The `decoded` field may be:

- number
- string
- boolean
- JSON object

Examples:

- number:
```json
{
  "decoded": 1726
}
```

- string:
```json
{
  "decoded": "WP0ZZZ99ZTS392124"
}
```

- boolean:
```json
{
  "decoded": true
}
```

- structured JSON:
```json
{
  "decoded": {
    "milOn": true,
    "storedDtcCount": 2
  }
}
```

## Question: What are the allowed measurement statuses?

Each measurement should use one of these statuses:

- `ok`
- `unsupported`
- `timeout`
- `error`

Meaning:

- `ok`
  - the PID was read successfully
- `unsupported`
  - the PID is not supported by this ECU/vehicle
- `timeout`
  - the request timed out
- `error`
  - something else failed

Example:

```json
{
  "mode": "01",
  "pid": "11",
  "key": "throttle_position_pct",
  "label": "Throttle position",
  "unit": "%",
  "status": "unsupported",
  "raw": null,
  "decoded": null
}
```

## Question: How should DTCs be returned?

If `includeDtcs = true`, the device should include a `dtcs` array.

Example:

```json
{
  "requestId": "diagnostic-request-id",
  "planId": "diagnostic-plan-id",
  "carId": "your-car-id",
  "generatedAt": "2026-04-16T16:46:00.000Z",
  "status": "ok",
  "measurements": [],
  "dtcs": [
    {
      "code": "P0301",
      "description": "Cylinder 1 misfire detected",
      "severity": "medium",
      "state": "stored",
      "sourceMode": "03"
    },
    {
      "code": "P0420",
      "description": "Catalyst system efficiency below threshold",
      "severity": "medium",
      "state": "pending",
      "sourceMode": "07"
    }
  ]
}
```

Allowed DTC states:

- `stored`
- `pending`
- `permanent`

Typical mapping:

- Mode `03` -> `stored`
- Mode `07` -> `pending`
- Mode `0A` -> `permanent`

## Question: What should a full diagnostic error response look like?

Example:

```json
{
  "requestId": "diagnostic-request-id",
  "planId": "diagnostic-plan-id",
  "carId": "your-car-id",
  "generatedAt": "2026-04-16T16:46:00.000Z",
  "status": "error",
  "measurements": [],
  "dtcs": [],
  "error": {
    "code": "ELM327_DISCONNECTED",
    "message": "The OBD adapter is not connected"
  }
}
```

## Question: Which MQTT topics should the device publish to?

Publish only to the telemetry response topics:

- Capability discovery response:
  - `cars/{carId}/telemetry/capabilities/response`
- Diagnostic response:
  - `cars/{carId}/telemetry/diagnostic/response`

Do not publish capability responses back onto the command topic.

Do not publish diagnostic results onto the capability topic.

## Question: Should the device listen to the same topic for capability and diagnostic requests?

No.

Use two request subscriptions:

- `cars/{carId}/commands/capabilities/request`
- `cars/{carId}/commands/diagnostic/request`

This makes it easy for the device firmware to dispatch logic correctly:

- capability handler
- diagnostic handler

## Question: What if the request includes PIDs from different modes?

That is allowed.

The backend may send PIDs from different OBD modes depending on the selected profile and what is supported.

The device should process every item independently using its `(mode, pid)` pair.

Example:

```json
{
  "pids": [
    { "key": "engine_rpm", "mode": "01", "pid": "0C" },
    { "key": "vin", "mode": "09", "pid": "02" }
  ]
}
```

## Question: How should the device be designed internally?

A good real-device architecture is:

1. MQTT client layer
2. command dispatcher
3. OBD adapter layer
4. PID decoder layer
5. JSON response builder
6. MQTT publisher

Suggested flow:

1. connect to Wi-Fi / Ethernet
2. connect to EMQX broker
3. subscribe to:
   - `cars/{carId}/commands/diagnostic/request`
   - `cars/{carId}/commands/capabilities/request`
4. when a request arrives:
   - parse JSON
   - validate fields
   - call the OBD adapter
   - decode values
   - publish JSON response

## Question: How do I test this with a real device and not the simulator?

To replace the simulator with a real device:

1. give the device a real `carId`
2. connect it to the same MQTT broker used by the backend
3. subscribe to:
   - `cars/{carId}/commands/diagnostic/request`
   - `cars/{carId}/commands/capabilities/request`
4. publish responses to:
   - `cars/{carId}/telemetry/diagnostic/response`
   - `cars/{carId}/telemetry/capabilities/response`
5. make sure the device returns the JSON payloads exactly as described here

Practical options:

- ESP32 + ELM327-compatible adapter
- Raspberry Pi + USB OBD adapter
- STM32 + CAN transceiver + MQTT/Wi-Fi module

For first real-device testing:

1. register a system device in the backend
2. create a vehicle
3. attach the device to the vehicle using its `deviceCode`
4. make sure the vehicle’s `mqttCarId` matches the MQTT topic namespace the device uses
5. trigger capability discovery
6. inspect the backend stored supported PIDs
7. trigger a diagnostic request

## Question: What are the most important implementation rules for the device teammate?

The device teammate should remember these rules:

- always echo `requestId`
- always echo `carId`
- use ISO timestamps for `generatedAt`
- publish JSON, not binary blobs
- return `raw` and `decoded` when possible
- include DTCs only when requested or when your implementation supports them for the request
- for capability discovery, return actual supported full PID codes, not just the mask windows
- use the correct MQTT topic pair for request/response
- keep the payload schema stable

## Summary

The backend-device contract is:

- backend sends MQTT commands
- device performs OBD queries
- device returns JSON responses

Topics:

- request:
  - `cars/{carId}/commands/capabilities/request`
  - `cars/{carId}/commands/diagnostic/request`
- response:
  - `cars/{carId}/telemetry/capabilities/response`
  - `cars/{carId}/telemetry/diagnostic/response`

Capability windows currently used by the backend:

- `0100`
- `0120`
- `0140`
- `0160`
- `0200`
- `0500`
- `0600`
- `0900`

Default rule:

- `raw` is for debugging
- `decoded` is for the backend

If the device follows this document, it can talk to the backend without needing the simulator.
