# Backend Testing Matrix

## Automated test commands

```powershell
cd .\backend
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

## Coverage by module

- `AuthService`
  - registration token issuance
  - invalid password handling
  - refresh-token flow
- `UsersService`
  - first user admin role assignment
  - duplicate email conflict
  - user lookup errors
- `VehiclesService`
  - vehicle creation ownership
  - device attach + capability discovery queue
  - discovery precondition validation
  - ownership access enforcement
- `PidCatalogService`
  - supported PID matrix retrieval
  - ownership checks
  - stale/fresh capability detection
- `DiagnosticsService`
  - request creation preconditions
  - async execution job enqueueing
  - run detail ownership guard
  - admin run detail access
- `DiagnosticsProcessor`
  - job routing to service handlers
  - unsupported job failure path
- `DiagnosticNormalizerService`
  - raw response normalization into long-format rows
  - missing measurement insertion
  - DTC persistence
- `DiagnosticSummaryService`
  - derived observation generation
  - missing measurement summarization
- `ReportsService`
  - schema validation
  - deterministic report text rendering
  - report ownership checks
- `RolesGuard`
  - role metadata checks and access decisions
- `Health endpoint e2e`
  - `/api/health` availability

## Infrastructure-level simulator verification

```powershell
cd .\infra\mqtt-cluster
.\scripts\test-simulator-e2e.ps1
```

Scenarios:

- success
- delay
- error
- timeout
- duplicate handling
- cross-node routing
