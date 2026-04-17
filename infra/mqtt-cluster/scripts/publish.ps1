param(
  [string]$Topic = "devices/demo-device/commands/diagnostic/request",
  [string]$Message = '{"requestId":"req-001","planId":"plan-001","deviceId":"demo-device","carId":"demo","type":"diagnostic","correlationId":"corr-001","includeDtcs":true,"timeoutMs":15000,"pids":[{"key":"engine_rpm","mode":"01","pid":"0C"},{"key":"vehicle_speed","mode":"01","pid":"0D"}],"simulate":{"mode":"success"}}',
  [ValidateSet("emqx1", "emqx2", "emqx3")]
  [string]$Broker = "emqx1"
)

$ErrorActionPreference = "Stop"
$clusterRoot = Split-Path -Parent $PSScriptRoot

Push-Location $clusterRoot
try {
  $base64Payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Message))
  $safeTopic = $Topic
  $publishCmd = "echo '$base64Payload' | base64 -d | mosquitto_pub -h $Broker -p 1883 -q 2 -t '$safeTopic' -s"
  docker compose exec -T mqtt-tools sh -lc $publishCmd
  Write-Host "Published to $Broker on topic '$Topic'."
}
finally {
  Pop-Location
}
