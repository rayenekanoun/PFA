# Backend MVP

This is the single NestJS backend for the connected-car diagnostics MVP.

It handles:

- JWT auth
- multi-user ownership
- vehicle and device onboarding
- capability discovery
- async diagnostic execution
- MQTT request/response orchestration
- measurement normalization
- AI-assisted report generation

## Stack

- NestJS
- Prisma
- PostgreSQL
- TimescaleDB
- Redis
- BullMQ
- MQTT
- Swagger

## Folder Map

- `src/auth` auth and JWT flows
- `src/users` user persistence helpers
- `src/vehicles` vehicles, devices, supported PID access
- `src/profiles` diagnostic profiles
- `src/pid-catalog` canonical PID catalog
- `src/diagnostics` async request lifecycle, planner, normalizer, workers
- `src/mqtt` MQTT client + contracts
- `src/ai` complaint classification + report generation adapters
- `src/reports` report persistence and retrieval
- `src/seeds` startup seed logic
- `prisma/` schema and migrations

## Prerequisites

- Node 20+
- Docker Desktop
- MQTT cluster running from `infra/mqtt-cluster`

## One-Command Run (Recommended)

From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1
```

Useful flags:

- `-SkipInstall` skip backend dependency installation
- `-NoBuild` skip backend build
- `-Foreground` run backend in the same terminal

Stop:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-all.ps1
```

Start backend + frontend together:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-fullstack.ps1
```

Purge Docker volumes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-all.ps1 -Purge
```

## Environment

Copy and adjust:

```powershell
Copy-Item .env.example .env
```

Default host-mode values expect:

- Postgres on `localhost:5432`
- Redis on `localhost:6379`
- EMQX brokers on `localhost:1883`, `localhost:2883`, `localhost:3883`
- Frontend origin `http://localhost:5173` allowed by default (`CORS_ORIGIN`)

Development helper:

- set `DEV_DISABLE_OWNERSHIP_FILTER=true` to disable per-user ownership filtering locally
- this flag is ignored in `production`

## AI provider setup

Supported providers:

- `stub`
- `openai-compatible`
- `gemini`
- `vertex`

Recommended for real AI in this project:

- set `AI_PROVIDER=vertex` (or `gemini`)
- keep `AI_ALLOW_STUB_FALLBACK=false` so provider failures are explicit

Gemini configuration example:

```env
AI_PROVIDER=gemini
AI_ALLOW_STUB_FALLBACK=false
AI_API_KEY=your_google_ai_key
AI_MODEL=gemini-2.5-flash
AI_BASE_URL=https://generativelanguage.googleapis.com
```

Vertex AI (service account file) configuration example:

```env
AI_PROVIDER=vertex
AI_ALLOW_STUB_FALLBACK=false
VERTEX_PROJECT_ID=your-gcp-project-id
VERTEX_LOCATION=us-central1
VERTEX_MODEL=gemini-2.5-flash
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
```

Vertex AI (inline service account JSON) configuration example:

```env
AI_PROVIDER=vertex
AI_ALLOW_STUB_FALLBACK=false
VERTEX_PROJECT_ID=your-gcp-project-id
VERTEX_LOCATION=us-central1
VERTEX_MODEL=gemini-2.5-flash
VERTEX_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n..."}
```

## Local Run

### 1. Start MQTT + simulator

```powershell
cd ..\\infra\\mqtt-cluster
.\\scripts\\start.ps1
```

### 2. Start database and Redis

```powershell
cd ..\\backend
docker compose up -d postgres redis
```

### 3. Apply migrations

```powershell
npm run prisma:migrate:deploy
```

### 4. Start backend

```powershell
npm install
npm run build
npm run start:prod
```

Swagger:

- `http://localhost:3000/api/docs`

Health:

- `http://localhost:3000/api/health`

## Docker Run

The backend compose file can also run the app container:

```powershell
docker compose up -d
```

Notes:

- the backend compose file joins the external `mqtt-net` network
- start `infra/mqtt-cluster` first so that `mqtt-net` exists

## Main Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

### Vehicles

- `POST /api/vehicles`
- `GET /api/vehicles`
- `GET /api/vehicles/:vehicleId`
- `POST /api/vehicles/:vehicleId/devices`
- `POST /api/vehicles/:vehicleId/discover-capabilities`
- `GET /api/vehicles/:vehicleId/supported-pids`

### Diagnostics

- `POST /api/diagnostic-requests`
- `GET /api/diagnostic-requests`
- `GET /api/diagnostic-requests/:requestId`
- `GET /api/diagnostic-runs/:runId`

### Reports

- `GET /api/reports/:requestId`

## Diagnostic Request Notes

Base request body:

```json
{
  "vehicleId": "vehicle-uuid",
  "complaintText": "My car consumes too much gasoline"
}
```

- Per-request simulator debug controls are disabled in the backend API.
- When using the local MQTT simulator, diagnostic commands run with simulator defaults (`success` mode) unless you change simulator internals.

## Async Lifecycle

Public request flow:

1. create diagnostic request
2. queue execution job
3. discover capabilities if needed
4. classify complaint
5. build plan
6. publish MQTT command
7. normalize measurements and DTCs
8. queue report generation
9. persist final report

Important statuses:

- request: `CREATED`, `DISCOVERING_CAPABILITIES`, `PLANNED`, `DISPATCHED`, `GENERATING_REPORT`, `COMPLETED`, `FAILED`
- run: `QUEUED`, `SENT`, `RESPONDED`, `PARTIAL`, `TIMEOUT`, `FAILED`

## Database

Migration path:

- `prisma/migrations/20260408150000_init`

Timescale setup:

- `DiagnosticMeasurement` is converted into a hypertable on `measuredAt`

## Tests

Backend tests:

```powershell
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Detailed matrix:

- `backend/TESTING.md`

From repo root, one command for backend + simulator tests:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-all.ps1
```

Simulator tests:

```powershell
cd ..\\infra\\mqtt-cluster\\simulator
npm test
npm run build
```

Cluster simulator E2E:

```powershell
cd ..\\infra\\mqtt-cluster
.\\scripts\\test-simulator-e2e.ps1
```

## Current Behavior Verified

Validated locally:

- successful auth flow
- vehicle creation
- device onboarding
- automatic capability discovery
- supported PID retrieval
- successful diagnostic request
- timeout diagnostic request with generated fallback report
