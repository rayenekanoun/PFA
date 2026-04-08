param(
  [switch]$Purge
)

$ErrorActionPreference = "Stop"
$clusterRoot = Split-Path -Parent $PSScriptRoot

Push-Location $clusterRoot
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
