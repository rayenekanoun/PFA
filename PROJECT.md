# Connected Car Diagnostics Platform

## 1. MVP Goal

This project is an on-demand connected-car diagnostics platform for car owners.

The MVP lets a user describe a problem like:

- "My car consumes too much gasoline"
- "The engine feels rough at idle"
- "I think the battery is weak"

The system then:

1. classifies the complaint into a diagnostic profile
2. checks which OBD2 PIDs the vehicle supports
3. sends one MQTT diagnostic job to the STM32 + ELM327 device
4. receives one MQTT response
5. normalizes the response into structured measurements and DTCs
6. generates a deterministic AI-assisted report from structured data only

The AI never interprets raw OBD bytes directly.

## 2. Current Architecture

The current MVP is a single NestJS backend, not a microservices system.

Main backend location:

- `backend/`

Frontend location:

- `frontend/`

Infrastructure:

- `infra/mqtt-cluster/` for the 3-node EMQX cluster and MQTT simulator

Core runtime stack:

- NestJS
- PostgreSQL
- TimescaleDB for `diagnostic_measurements`
- Redis
- BullMQ
- Prisma
- JWT auth
- Swagger
- AI provider adapter (`stub`, `openai-compatible`, `gemini`, `vertex`)

## 2.1 One-Command Local Run

From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1
```

This script starts:

- MQTT cluster + simulator
- Postgres + Redis
- Prisma migrations
- backend API

Useful flags:

- `-SkipInstall` skip `npm install` in `backend/`
- `-NoBuild` skip `npm run build`
- `-Foreground` run backend in the current terminal

Stop everything:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-all.ps1
```

Start frontend only:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-frontend.ps1
```

Start backend stack + frontend together:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-fullstack.ps1
```

Run complete automated test suite:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-all.ps1
```

Run complete suite including Docker MQTT E2E:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-all.ps1 -WithInfraE2E
```

Optional full cleanup (volumes too):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-all.ps1 -Purge
```

## 3. End-to-End Workflow

### A. User creates a diagnostic request

The backend stores:

- user
- vehicle
- complaint text
- initial request status

### B. AI classifies the complaint

The AI maps the complaint to a diagnostic profile such as:

- `fuel_consumption`
- `overheating`
- `rough_idle`
- `battery_issue`

The backend stores:

- selected profile
- confidence
- rationale

### C. Backend planner builds the read plan

The planner uses:

- classified profile
- vehicle information
- `vehicle_supported_pids`

It produces:

- filtered PID list
- whether DTCs should be included
- planner notes

### D. Backend dispatches one MQTT job

Command topic:

- `devices/{deviceId}/commands/diagnostic/request`

Command payload contains:

- `requestId`
- `planId`
- `carId`
- `correlationId`
- `includeDtcs`
- `timeoutMs`
- `pids[]`

Per-request simulator debug controls are removed from the API. The local simulator is only used to provide synthetic device readings until physical hardware is connected.

### E. Device executes and responds once

Response topic:

- `devices/{deviceId}/telemetry/diagnostic/response`

Response contains:

- request metadata
- `status`
- `measurements[]`
- `dtcs[]`
- optional `error`

### F. Backend stores raw + normalized data

The backend keeps:

- raw MQTT command and raw response on `diagnostic_runs`
- normalized row-based measurements in `diagnostic_measurements`
- DTCs in `diagnostic_dtcs`

### G. Backend builds structured summary

Before the report is generated, the backend prepares:

- complaint
- profile
- requested measurements
- received measurements
- DTCs
- missing measurements
- derived observations

### H. AI generates the report

The AI sees only normalized structured data.

It returns a fixed JSON schema:

- `summary`
- `possibleCauses[]`
- `nextSteps[]`
- `caveats[]`
- `confidence`

The backend then renders the final human-readable report text deterministically.

## 4. Authentication And Ownership

Auth endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

Rules:

- users only access their own vehicles, requests, runs, and reports
- the first registered account becomes `ADMIN`
- later accounts become `USER`

Local development override:

- set `DEV_DISABLE_OWNERSHIP_FILTER=true` in `backend/.env` to view all users' data while debugging
- this override is ignored in production

## 5. Vehicle And Device Model

One active device is linked to one vehicle in the MVP.

Endpoints:

- `POST /api/vehicles`
- `GET /api/vehicles`
- `GET /api/vehicles/:vehicleId`
- `POST /api/vehicles/:vehicleId/devices`

When a device is attached, the backend queues a capability discovery job automatically.

## 6. Capability Discovery

Capability discovery is a first-class concept in the MVP.

Why it exists:

- vehicles do not support the same PIDs
- the planner must filter profile PIDs against real supported PIDs

Capability discovery topic flow:

- command: `devices/{deviceId}/commands/capabilities/request`
- response: `devices/{deviceId}/telemetry/capabilities/response`

The backend stores the result in:

- `vehicle_supported_pids`

The matrix is refreshed:

- on device onboarding
- on demand through `POST /api/vehicles/:vehicleId/discover-capabilities`
- automatically before diagnostics if support data is missing or stale

## 7. Database Model

Main tables:

- `users`
- `refresh_tokens`
- `vehicles`
- `devices`
- `diagnostic_profiles`
- `obd_pid_catalog`
- `vehicle_supported_pids`
- `diagnostic_requests`
- `diagnostic_plans`
- `diagnostic_runs`
- `diagnostic_measurements`
- `diagnostic_dtcs`
- `diagnostic_reports`

Canonical lifecycle:

- `diagnostic_requests -> diagnostic_plans -> diagnostic_runs -> diagnostic_measurements / diagnostic_dtcs -> diagnostic_reports`

Important design choice:

- `diagnostic_measurements` is a long-format flexible table, not a wide table with one column per PID

That is how the backend handles variable result shapes safely.

## 8. OBD2 Strategy

The OBD reference in `infra/obd2_reference (1).html` is used as a working engineering reference.

MVP usage focuses on:

- Mode `01` live data
- Mode `03` stored DTCs
- Mode `07` pending DTCs
- Mode `0A` permanent DTCs
- Mode `09` identity later when needed

The backend owns:

- PID catalog
- decoding metadata
- normalization
- report inputs

The device is allowed to return:

- raw OBD values
- simple decoded values when convenient

## 9. MQTT Simulator

The simulator exists so the backend can be validated before real STM32 firmware is ready.

It currently supports:

- diagnostic command/response
- capability discovery command/response
- success
- delay
- error
- timeout
- duplicate request protection

Simulator location:

- `infra/mqtt-cluster/simulator/`

## 10. Backend API Surface

Currently implemented:

- auth
- vehicles and device onboarding
- profile listing
- PID catalog listing for admins
- vehicle supported PID retrieval
- diagnostic request creation
- diagnostic request list/detail
- diagnostic run detail
- report detail
- health endpoint
- Swagger docs at `/api/docs`

## 10.1 Frontend MVP Surface

Implemented dashboard in `frontend/`:

- register/login/logout
- vehicle create/list
- device attach
- capability discovery trigger
- supported PID matrix fetch
- diagnostic request create/list/detail
- report fetch and rendering

## 11. Async Processing Model

BullMQ jobs:

- `discover_vehicle_capabilities`
- `execute_diagnostic_request`
- `generate_diagnostic_report`

The HTTP API is asynchronous:

- `POST /api/diagnostic-requests` returns immediately
- clients poll `GET /api/diagnostic-requests/:id`

## 12. Local Validation Status

Validated locally:

- backend build passes
- backend unit tests pass
- backend e2e health test passes
- simulator build passes
- simulator tests pass
- real local stack flow passes:
  - auth
  - vehicle creation
  - device attachment
  - capability discovery
  - success diagnostic request
  - timeout diagnostic request

## 13. MVP Boundaries

Included now:

- on-demand diagnostics
- multi-user auth
- vehicle ownership
- capability discovery
- async request pipeline
- normalized measurements
- AI-generated structured report

Explicitly not included yet:

- frontend
- continuous monitoring
- fleet management
- TLS/authenticated MQTT in production
- audio diagnostics
- blockchain/history anchoring
- predictive maintenance

## 14. Next Logical Steps

After the current backend MVP, the next strong steps are:

1. replace simulator transport with real STM32 transport in staging/production
2. expand OBD normalization coverage beyond the seeded PID set
3. add frontend screens for vehicles, requests, runs, and reports
4. harden production MQTT auth and TLS
5. add real integration tests around auth and request ownership with the running stack
