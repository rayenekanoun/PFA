param()

$ErrorActionPreference = "Stop"
$clusterRoot = Split-Path -Parent $PSScriptRoot

function Get-ClusterStatus {
  try {
    $out = docker compose exec -T emqx1 sh -lc "emqx ctl cluster status || /opt/emqx/bin/emqx ctl cluster status" 2>&1
    return @{
      ExitCode = $LASTEXITCODE
      Output = ($out -join "`n")
    }
  } catch {
    return @{
      ExitCode = 1
      Output = $_.Exception.Message
    }
  }
}

Push-Location $clusterRoot
try {
  if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example"
  }

  docker compose up -d emqx1 emqx2 emqx3 mqtt-tools
  docker compose up -d --build simulator

  $deadline = (Get-Date).AddMinutes(2)
  $ready = $false

  while ((Get-Date) -lt $deadline) {
    $statusResult = Get-ClusterStatus
    $status = $statusResult.Output
    if ($statusResult.ExitCode -eq 0 -and $status -match "emqx@emqx1\.mqtt\.local" -and $status -match "emqx@emqx2\.mqtt\.local" -and $status -match "emqx@emqx3\.mqtt\.local") {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 4
  }

  if (-not $ready) {
    Write-Host "Cluster failed to report all 3 nodes. Recent logs:"
    docker compose logs --tail=80 emqx1 emqx2 emqx3
    Write-Host "Tip: if node names changed, run .\\scripts\\stop.ps1 -Purge then start again."
    exit 1
  }

  Write-Host "MQTT cluster is up."
  docker compose exec -T emqx1 sh -lc "emqx ctl cluster status || /opt/emqx/bin/emqx ctl cluster status"
  docker compose ps simulator
}
finally {
  Pop-Location
}
