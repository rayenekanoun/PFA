# Frontend MVP Dashboard

React + TypeScript + Vite dashboard for your backend MVP.

## What this frontend covers

- auth (`register`, `login`, `logout`)
- vehicle creation and listing
- device attachment
- capability discovery trigger
- vehicle supported PID retrieval
- diagnostic request creation
- diagnostic request list/detail
- final report retrieval

The UI is intentionally schema-flexible for diagnostics and report payloads.

## Setup

```powershell
cd .\frontend
Copy-Item .env.example .env
npm install
```

## Run

```powershell
npm run dev
```

Default URL:

- `http://localhost:5173`

Backend API base URL is read from:

- `VITE_API_BASE_URL`

Default value:

- `http://localhost:3000/api`

From repo root you can also use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-frontend.ps1
```

## Build

```powershell
npm run build
```

## Notes

- Backend CORS is configured for `http://localhost:5173` by default.
- If your frontend runs on a different origin, update backend `CORS_ORIGIN`.
