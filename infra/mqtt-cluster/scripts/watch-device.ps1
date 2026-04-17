param(
  [Parameter(Mandatory = $true)]
  [string]$DeviceId,
  [ValidateSet("emqx1", "emqx2", "emqx3")]
  [string]$Broker = "emqx1",
  [int]$Count = 0
)

$ErrorActionPreference = "Stop"
$clusterRoot = Split-Path -Parent $PSScriptRoot
$topic = "devices/$DeviceId/commands/#"

Push-Location $clusterRoot
try {
  $cmd = @("mosquitto_sub", "-h", $Broker, "-p", "1883", "-t", $topic, "-v")
  if ($Count -gt 0) {
    $cmd += @("-C", $Count.ToString())
  }

  docker compose exec -T mqtt-tools @cmd
}
finally {
  Pop-Location
}
