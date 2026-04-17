param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
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
    Write-Host "Stopping existing backend process (PID $existingPid)..."
    Stop-Process -Id $existingPid -Force
  }

  Remove-Item -Path $backendPidFile -ErrorAction SilentlyContinue
}

function Reset-BackendDatabase {
  Write-Host "Dropping and recreating database..."

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
    "postgres",
    "-c",
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'car_diagnostics' AND pid <> pg_backend_pid();"
  )

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
    "postgres",
    "-c",
    "DROP DATABASE IF EXISTS car_diagnostics;"
  )

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
    "postgres",
    "-c",
    "CREATE DATABASE car_diagnostics;"
  )
}

Assert-CommandExists -Name "docker"
Assert-CommandExists -Name "npm"
Assert-CommandExists -Name "node"

if (-not (Test-Path $backendDir)) {
  throw "Backend directory not found at '$backendDir'."
}

if (-not (Test-Path (Join-Path $backendDir ".env"))) {
  Copy-Item -Path (Join-Path $backendDir ".env.example") -Destination (Join-Path $backendDir ".env")
  Write-Host "Created backend/.env from backend/.env.example"
}

Stop-TrackedBackendIfRunning

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

  Reset-BackendDatabase

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

  Write-Host "Applying database migrations..."
  Invoke-CheckedExternal -FilePath "npm" -ArgumentList @("run", "prisma:migrate:deploy")

  Write-Host "Generating Prisma client..."
  Invoke-CheckedExternal -FilePath "npm" -ArgumentList @("run", "prisma:generate")

  Write-Host "Seeding reference data and development admin..."
  Invoke-CheckedExternal -FilePath "npm" -ArgumentList @("run", "db:seed:dev-admin")
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "Fresh backend database is ready."
Write-Host "Development admin credentials:"
Write-Host "  Email: admin@pfa.local"
Write-Host "  Password: Admin12345!"
Write-Host ""
Write-Host "You can override them in backend/.env with:"
Write-Host "  DEV_ADMIN_EMAIL=..."
Write-Host "  DEV_ADMIN_PASSWORD=..."
Write-Host "  DEV_ADMIN_DISPLAY_NAME=..."
