param(
  [string]$Topic = "cars/+/telemetry/#",
  [ValidateSet("emqx1", "emqx2", "emqx3")]
  [string]$Broker = "emqx1",
  [int]$Count = 0
)

$ErrorActionPreference = "Stop"
$clusterRoot = Split-Path -Parent $PSScriptRoot

Push-Location $clusterRoot
try {
  $cmd = @("mosquitto_sub", "-h", $Broker, "-p", "1883", "-t", $Topic, "-v")
  if ($Count -gt 0) {
    $cmd += @("-C", $Count.ToString())
  }

  docker compose exec -T mqtt-tools @cmd
}
finally {
  Pop-Location
}
