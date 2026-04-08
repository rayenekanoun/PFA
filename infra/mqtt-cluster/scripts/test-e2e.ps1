param(
  [string]$Topic = "cars/test/events/cluster-check"
)

$ErrorActionPreference = "Stop"
$clusterRoot = Split-Path -Parent $PSScriptRoot
$payload = "cluster-ok-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

Push-Location $clusterRoot
try {
  $subscriber = Start-Job -ArgumentList $clusterRoot, $Topic -ScriptBlock {
    param($root, $testTopic)
    Set-Location $root
    docker compose exec -T mqtt-tools mosquitto_sub -h emqx2 -p 1883 -t $testTopic -C 1 -W 20
  }

  Start-Sleep -Seconds 2
  docker compose exec -T mqtt-tools mosquitto_pub -h emqx3 -p 1883 -t $Topic -m $payload

  $received = Receive-Job -Job $subscriber -Wait -AutoRemoveJob
  if ($received -match [regex]::Escape($payload)) {
    Write-Host "PASS: Cross-node publish/subscribe works. Payload: $payload"
    exit 0
  }

  Write-Host "FAIL: Did not receive expected payload."
  Write-Host "Expected: $payload"
  Write-Host "Received: $received"
  exit 1
}
finally {
  Pop-Location
}
