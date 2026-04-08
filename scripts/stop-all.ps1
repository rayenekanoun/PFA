param(
  [switch]$Purge
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$infraDir = Join-Path $repoRoot "infra\mqtt-cluster"
$backendDir = Join-Path $repoRoot "backend"
$backendPidFile = Join-Path $PSScriptRoot ".backend.pid"

if (Test-Path $backendPidFile) {
  $pidText = Get-Content -Path $backendPidFile -ErrorAction SilentlyContinue
  if ($pidText) {
    $process = Get-Process -Id $pidText -ErrorAction SilentlyContinue
    if ($process) {
      Write-Host "Stopping backend process PID $pidText..."
      Stop-Process -Id $pidText -Force
    }
  }
  Remove-Item -Path $backendPidFile -Force -ErrorAction SilentlyContinue
}

# Fallback 1: stop any node process listening on backend port 3000.
$backendPortProcessIds = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $backendPortProcessIds) {
  $portProcess = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($portProcess -and $portProcess.ProcessName -eq "node") {
    Write-Host "Stopping backend process PID $processId (detected on port 3000)..."
    Stop-Process -Id $processId -Force
  }
}

# Fallback: if backend was started manually (without pid file), try to stop it by command line signature.
$backendProcessCandidates = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object {
    $_.CommandLine -like "*dist/src/main.js*" -or
    $_.CommandLine -like "*dist\src\main.js*" -or
    $_.CommandLine -like "*backend*nest*start*"
  }

foreach ($candidate in $backendProcessCandidates) {
  $process = Get-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue
  if ($process) {
    Write-Host "Stopping backend process PID $($candidate.ProcessId) (detected by command line)..."
    Stop-Process -Id $candidate.ProcessId -Force
  }
}

if (Test-Path $backendDir) {
  Push-Location $backendDir
  try {
    if ($Purge) {
      docker compose down -v --remove-orphans
    } else {
      docker compose down --remove-orphans
    }
  }
  finally {
    Pop-Location
  }
}

if (Test-Path $infraDir) {
  $stopScript = Join-Path $infraDir "scripts\stop.ps1"
  if ($Purge) {
    & $stopScript -Purge
  } else {
    & $stopScript
  }
}

Write-Host "All services stopped."
