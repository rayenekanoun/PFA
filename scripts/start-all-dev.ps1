param(
  [switch]$SkipInstall,
  [switch]$SkipMigrations
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$infraDir = Join-Path $repoRoot "infra\mqtt-cluster"
$backendDir = Join-Path $repoRoot "backend"
$backendPidFile = Join-Path $PSScriptRoot ".backend.pid"

function Assert-CommandExists {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

function Wait-ContainerHealthy {
  param(
    [string]$ContainerName,
    [int]$TimeoutSeconds = 90
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $health = docker inspect --format "{{.State.Health.Status}}" $ContainerName 2>$null
    if ($LASTEXITCODE -eq 0 -and $health -eq "healthy") {
      return
    }
    Start-Sleep -Seconds 2
  }

  throw "Container '$ContainerName' did not become healthy within $TimeoutSeconds seconds."
}

function Invoke-CheckedExternal {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList = @()
  )

  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($ArgumentList -join ' ')"
  }
}

function Stop-TrackedBackendIfRunning {
  if (-not (Test-Path $backendPidFile)) {
    return
  }

  $existingPid = Get-Content -Path $backendPidFile -ErrorAction SilentlyContinue
  if (-not $existingPid) {
    return
  }

  $process = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
  if ($process) {
    Write-Host "Stopping existing detached backend process (PID $existingPid)..."
    Stop-Process -Id $existingPid -Force
  }

  Remove-Item -Path $backendPidFile -ErrorAction SilentlyContinue
}

Assert-CommandExists -Name "docker"
Assert-CommandExists -Name "npm"
Assert-CommandExists -Name "node"

if (-not (Test-Path $infraDir)) {
  throw "MQTT cluster directory not found at '$infraDir'."
}

if (-not (Test-Path $backendDir)) {
  throw "Backend directory not found at '$backendDir'."
}

if (-not (Test-Path (Join-Path $backendDir ".env"))) {
  Copy-Item -Path (Join-Path $backendDir ".env.example") -Destination (Join-Path $backendDir ".env")
  Write-Host "Created backend/.env from backend/.env.example"
}

Stop-TrackedBackendIfRunning

Write-Host "Starting MQTT cluster and simulator..."
& (Join-Path $infraDir "scripts\start.ps1")

Write-Host "Starting Postgres and Redis..."
Push-Location $backendDir
try {
  docker compose up -d postgres redis
}
finally {
  Pop-Location
}

Wait-ContainerHealthy -ContainerName "car-diagnostics-postgres" -TimeoutSeconds 120
Wait-ContainerHealthy -ContainerName "car-diagnostics-redis" -TimeoutSeconds 60
Write-Host "Database and Redis are healthy."

Push-Location $backendDir
try {
  if (-not $SkipInstall) {
    Write-Host "Installing backend dependencies..."
    Invoke-CheckedExternal -FilePath "npm" -ArgumentList @("install")
  }

  Write-Host "Ensuring TimescaleDB extension exists..."
  Invoke-CheckedExternal -FilePath "docker" -ArgumentList @(
    "exec",
    "car-diagnostics-postgres",
    "psql",
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    "car_diagnostics",
    "-c",
    "CREATE EXTENSION IF NOT EXISTS timescaledb;"
  )

  if (-not $SkipMigrations) {
    Write-Host "Applying database migrations..."
    Invoke-CheckedExternal -FilePath "npm" -ArgumentList @("run", "prisma:migrate:deploy")
  }

  Write-Host "Starting backend in development watch mode..."
  npm run start:dev
}
finally {
  Pop-Location
}
