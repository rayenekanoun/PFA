param(
  [switch]$WithInfraE2E,
  [switch]$KeepInfraRunning
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$simulatorDir = Join-Path $repoRoot "infra\mqtt-cluster\simulator"
$clusterDir = Join-Path $repoRoot "infra\mqtt-cluster"

Write-Host "Running backend unit/integration tests..."
Push-Location $backendDir
try {
  npm test -- --runInBand
  npm run test:e2e -- --runInBand
}
finally {
  Pop-Location
}

Write-Host "Running simulator unit/contract tests..."
Push-Location $simulatorDir
try {
  npm test
  npm run test:contract
}
finally {
  Pop-Location
}

if ($WithInfraE2E) {
  Write-Host "Running infrastructure MQTT simulator E2E..."
  Push-Location $clusterDir
  try {
    .\scripts\start.ps1
    .\scripts\test-simulator-e2e.ps1
  }
  finally {
    if (-not $KeepInfraRunning) {
      .\scripts\stop.ps1
    }
    Pop-Location
  }
}

Write-Host "All requested tests completed."
