param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "frontend"

if (-not (Test-Path $frontendDir)) {
  throw "Frontend directory not found at '$frontendDir'."
}

Push-Location $frontendDir
try {
  if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created frontend/.env from frontend/.env.example"
  }

  if (-not $SkipInstall) {
    npm install
  }

  npm run dev
}
finally {
  Pop-Location
}
