param(
  [switch]$SkipInstall,
  [switch]$NoBuild,
  [switch]$Foreground
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$infraDir = Join-Path $repoRoot "infra\mqtt-cluster"
$backendDir = Join-Path $repoRoot "backend"
$backendPidFile = Join-Path $PSScriptRoot ".backend.pid"
$logsDir = Join-Path $repoRoot "logs"
$backendOutLog = Join-Path $logsDir "backend.out.log"
$backendErrLog = Join-Path $logsDir "backend.err.log"
$healthUrl = "http://localhost:3000/api/health"

function Assert-CommandExists {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

function Invoke-BackendHealthCheck {
  try {
    $response = Invoke-RestMethod -Method Get -Uri $healthUrl -TimeoutSec 3
    return ($response.status -eq "ok")
  } catch {
    return $false
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

function Start-BackendDetached {
  if (-not (Test-Path $logsDir)) {
    New-Item -Path $logsDir -ItemType Directory | Out-Null
  }

  if (Test-Path $backendPidFile) {
    $existingPid = Get-Content -Path $backendPidFile -ErrorAction SilentlyContinue
    if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
      Write-Host "Backend process already running with PID $existingPid."
      return
    }
  }

  $process = Start-Process -FilePath "node.exe" `
    -ArgumentList @("dist/src/main.js") `
    -WorkingDirectory $backendDir `
    -PassThru `
    -RedirectStandardOutput $backendOutLog `
    -RedirectStandardError $backendErrLog

  Set-Content -Path $backendPidFile -Value $process.Id
  Write-Host "Backend started in detached mode (PID $($process.Id))."
  Write-Host "Logs: $backendOutLog"
  Write-Host "Errors: $backendErrLog"
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
    "-U",
    "postgres",
    "-d",
    "car_diagnostics",
    "-c",
    "CREATE EXTENSION IF NOT EXISTS timescaledb;"
  )

  Write-Host "Applying database migrations..."
  Invoke-CheckedExternal -FilePath "npm" -ArgumentList @("run", "prisma:migrate:deploy")

  if (-not $NoBuild) {
    Write-Host "Building backend..."
    Invoke-CheckedExternal -FilePath "npm" -ArgumentList @("run", "build")
  }
}
finally {
  Pop-Location
}

if (Invoke-BackendHealthCheck) {
  Write-Host "Backend already responding at $healthUrl"
} else {
  if ($Foreground) {
    Write-Host "Starting backend in foreground..."
    Push-Location $backendDir
    try {
      npm run start:prod
    }
    finally {
      Pop-Location
    }
  } else {
    Start-BackendDetached
  }
}

if (-not $Foreground) {
  $deadline = (Get-Date).AddSeconds(45)
  $ready = $false
  while ((Get-Date) -lt $deadline) {
    if (Invoke-BackendHealthCheck) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 2
  }

  if ($ready) {
    Write-Host "Backend is healthy: $healthUrl"
    Write-Host "Swagger: http://localhost:3000/api/docs"
  } else {
    Write-Host "Backend did not become healthy in time. Check logs:"
    Write-Host "  $backendOutLog"
    Write-Host "  $backendErrLog"
    exit 1
  }
}
