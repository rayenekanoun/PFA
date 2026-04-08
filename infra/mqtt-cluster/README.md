# MQTT Cluster (EMQX)

This folder provides a local 3-node MQTT cluster aligned with `PROJECT.md`.

Nodes:
- `emqx1` -> host MQTT `localhost:1883`, dashboard `http://localhost:18083`
- `emqx2` -> host MQTT `localhost:2883`
- `emqx3` -> host MQTT `localhost:3883`

## Prerequisites

- Docker Desktop running
- PowerShell

## 1) Run the cluster

From repo root:

```powershell
cd .\infra\mqtt-cluster
Copy-Item .env.example .env   # first time only
.\scripts\start.ps1
```

Dashboard login:
- URL: `http://localhost:18083`
- User: `admin`
- Password: `public` (or your value from `.env`)

## 2) Verify cluster membership

```powershell
.\scripts\status.ps1
```

Expected output includes:
- `emqx@emqx1.mqtt.local`
- `emqx@emqx2.mqtt.local`
- `emqx@emqx3.mqtt.local`

## 3) End-to-end cluster test

This test subscribes on `emqx2` and publishes on `emqx3`.  
If it passes, cross-node routing works.

```powershell
.\scripts\test-e2e.ps1
```

Expected result:
- `PASS: Cross-node publish/subscribe works`

## 4) Use it (manual pub/sub)

Terminal A:

```powershell
.\scripts\subscribe.ps1 -Broker emqx1 -Topic "cars/+/commands/#"
```

Terminal B:

```powershell
.\scripts\publish.ps1 -Broker emqx3 -Topic "cars/demo/commands/diagnostic/request" -Message '{"requestId":"req-100","planId":"plan-100","carId":"demo","type":"diagnostic","correlationId":"corr-100","includeDtcs":true,"timeoutMs":15000,"pids":[{"key":"engine_rpm","mode":"01","pid":"0C"},{"key":"vehicle_speed","mode":"01","pid":"0D"},{"key":"maf","mode":"01","pid":"10"}],"simulate":{"mode":"success"}}'
```

You should see the message in Terminal A.

## 5) Diagnostic simulator (request/response contract)

`start.ps1` now starts a TypeScript simulator container (`mqtt-simulator`) alongside the cluster.

Supported topics:
- Subscribe: `cars/{carId}/commands/#` (`qos=2`)
- Diagnostic command publish: `cars/{carId}/telemetry/diagnostic/response` (`qos=2`)
- Capability response publish: `cars/{carId}/telemetry/capabilities/response` (`qos=2`)

Supported command types:
- `diagnostic`
- `capability_discovery`

Diagnostic command payload:
- `requestId`
- `planId`
- `carId`
- `type = "diagnostic"`
- `correlationId`
- `includeDtcs`
- `timeoutMs`
- `pids[]`
- optional `simulate`

Diagnostic response payload:
- `requestId`
- `planId`
- `carId`
- `status`
- `measurements[]`
- `dtcs[]`
- optional `error`

Capability discovery command payload:
- `requestId`
- `carId`
- `type = "capability_discovery"`
- optional `correlationId`
- `supportWindows[]`

Capability discovery response payload:
- `requestId`
- `carId`
- `status`
- `supportWindows[]`
- `supportedPidCodes[]`
- optional `error`

Supported simulator modes:
- `success`
- `delay`
- `error`
- `timeout`

The NestJS backend uses these same contracts for:
- device onboarding capability discovery
- fallback capability re-discovery before planning
- normal diagnostic request execution

Run contract + behavior E2E:

```powershell
.\scripts\test-simulator-e2e.ps1
```

Run simulator unit/contract tests:

```powershell
cd .\simulator
npm install
npm run test
npm run test:contract
```

Manual capability discovery example:

```powershell
.\scripts\publish.ps1 -Broker emqx2 -Topic "cars/demo/commands/capabilities/request" -Message '{"requestId":"cap-100","carId":"demo","type":"capability_discovery","correlationId":"cap-corr-100","supportWindows":["0100","0120","0140"]}'
```

## 6) Stop

```powershell
.\scripts\stop.ps1
```

To remove volumes/data too:

```powershell
.\scripts\stop.ps1 -Purge
```

Use `-Purge` at least once after cluster node-name config changes (or if you see cluster join issues).

## NestJS integration example

Use MQTT server failover list:

```ts
import { connect } from "mqtt";

const client = connect({
  servers: [
    { host: "localhost", port: 1883 },
    { host: "localhost", port: 2883 },
    { host: "localhost", port: 3883 },
  ],
  reconnectPeriod: 1000,
  clientId: `diag-api-${Date.now()}`,
});
```

For production, expose a single load-balanced endpoint in front of the cluster.

## Production (separate VPS per broker)

For a 3-VPS broker cluster + dedicated load balancer VPS, use:

- `infra/mqtt-cluster/production/README.md`

That folder includes:
- `broker-compose.yml` (run one broker per VPS)
- `lb-compose.yml` + `haproxy.cfg` (single MQTT entrypoint)
- end-to-end test scripts
