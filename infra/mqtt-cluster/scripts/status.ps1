param()

$ErrorActionPreference = "Stop"
$clusterRoot = Split-Path -Parent $PSScriptRoot

Push-Location $clusterRoot
try {
  try {
    docker compose exec -T emqx1 sh -lc "emqx ctl cluster status || /opt/emqx/bin/emqx ctl cluster status"
  } catch {
    Write-Host "Unable to fetch cluster status from emqx1."
    docker compose logs --tail=80 emqx1
    exit 1
  }
}
finally {
  Pop-Location
}
