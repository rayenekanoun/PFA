param(
  [string]$CarId = "sim-demo",
  [int]$WaitSeconds = 8
)

$ErrorActionPreference = "Stop"
$clusterRoot = Split-Path -Parent $PSScriptRoot
$commandTopic = "cars/$CarId/commands/diagnostic/request"
$responseTopic = "cars/$CarId/telemetry/diagnostic/response"

function New-RequestId {
  param([string]$Prefix)
  return "req-$Prefix-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$((Get-Random -Minimum 1000 -Maximum 9999))"
}

function Start-ResponseSubscriber {
  param(
    [string]$Broker,
    [int]$Count,
    [int]$TimeoutSec
  )

  return Start-Job -ArgumentList $clusterRoot, $Broker, $responseTopic, $Count, $TimeoutSec -ScriptBlock {
    param($root, $brokerName, $topicName, $messageCount, $timeout)
    Set-Location $root

    $output = & docker compose exec -T mqtt-tools mosquitto_sub -h $brokerName -p 1883 -t $topicName -C $messageCount -W $timeout 2>&1
    $exitCode = $LASTEXITCODE

    [pscustomobject]@{
      ExitCode = $exitCode
      Output = ($output -join "`n")
    }
  }
}

function Publish-Command {
  param(
    [string]$Broker,
    [hashtable]$Payload
  )

  $json = $Payload | ConvertTo-Json -Depth 8 -Compress
  $base64Payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
  $safeTopic = $commandTopic
  $publishCmd = "echo '$base64Payload' | base64 -d | mosquitto_pub -h $Broker -p 1883 -q 2 -t '$safeTopic' -s"
  docker compose exec -T mqtt-tools sh -lc $publishCmd
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to publish command to broker '$Broker'."
  }
}

function Receive-SubscriberResult {
  param([System.Management.Automation.Job]$Job)
  try {
    Wait-Job -Job $Job -ErrorAction Stop | Out-Null
    return Receive-Job -Job $Job -ErrorAction Stop
  } finally {
    Remove-Job -Job $Job -Force -ErrorAction SilentlyContinue
  }
}

function Get-PayloadFromSubscriberOutput {
  param([string]$Output)

  $lines = @($Output -split "\r?\n" | Where-Object { $_.Trim().Length -gt 0 })
  if ($lines.Count -eq 0) {
    throw "Subscriber returned no payload output."
  }

  for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    $line = $lines[$i].Trim()
    if ($line.StartsWith("{") -and $line.EndsWith("}")) {
      return $line
    }
  }

  throw "Subscriber output did not contain a JSON payload. Output: $Output"
}

function Assert-StructuredResponse {
  param(
    [object]$SubscriberResult,
    [string]$ExpectedRequestId,
    [string]$ExpectedStatus,
    [string]$ExpectedErrorCode = ""
  )

  if ($SubscriberResult.ExitCode -ne 0) {
    throw "Expected response but subscriber exited with code $($SubscriberResult.ExitCode). Output: $($SubscriberResult.Output)"
  }

  $payloadText = Get-PayloadFromSubscriberOutput -Output $SubscriberResult.Output
  $response = $payloadText | ConvertFrom-Json -ErrorAction Stop

  if ($response.requestId -ne $ExpectedRequestId) {
    throw "Response requestId mismatch. Expected '$ExpectedRequestId', got '$($response.requestId)'."
  }
  if ($response.carId -ne $CarId) {
    throw "Response carId mismatch. Expected '$CarId', got '$($response.carId)'."
  }
  if ($response.status -ne $ExpectedStatus) {
    throw "Response status mismatch. Expected '$ExpectedStatus', got '$($response.status)'."
  }
  if ($response.simulated -ne $true) {
    throw "Response simulated flag must be true."
  }
  if (-not $response.generatedAt) {
    throw "Response generatedAt is missing."
  }

  if ($ExpectedStatus -eq "ok" -and -not $response.measurements) {
    throw "Success response is missing measurements payload."
  }

  if ($ExpectedStatus -eq "error") {
    if (-not $response.error) {
      throw "Error response is missing error object."
    }
    if ($ExpectedErrorCode.Length -gt 0 -and $response.error.code -ne $ExpectedErrorCode) {
      throw "Error code mismatch. Expected '$ExpectedErrorCode', got '$($response.error.code)'."
    }
  }
}

function Assert-NoResponse {
  param([object]$SubscriberResult)

  if ($SubscriberResult.ExitCode -eq 0) {
    throw "Expected no response, but a payload was received: $($SubscriberResult.Output)"
  }
}

function Assert-DockerAvailable {
  try {
    docker info | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Docker command returned non-zero exit code."
    }
  } catch {
    throw "Docker Desktop is not running or not reachable. Start Docker Desktop, then rerun this script."
  }
}

Push-Location $clusterRoot
try {
  Assert-DockerAvailable
  docker compose up -d emqx1 emqx2 emqx3 mqtt-tools
  docker compose up -d --build simulator
  Start-Sleep -Seconds 3

  Write-Host "Running simulator E2E tests on carId '$CarId'..."

  # 1) Happy path success (cross-node: publish emqx3, subscribe emqx2)
  $reqSuccess = New-RequestId -Prefix "success"
  $jobSuccess = Start-ResponseSubscriber -Broker "emqx2" -Count 1 -TimeoutSec $WaitSeconds
  Start-Sleep -Milliseconds 700
  Publish-Command -Broker "emqx3" -Payload @{
    requestId = $reqSuccess
    carId = $CarId
    type = "diagnostic"
    simulate = @{
      mode = "success"
    }
  }
  $resultSuccess = Receive-SubscriberResult -Job $jobSuccess
  Assert-StructuredResponse -SubscriberResult $resultSuccess -ExpectedRequestId $reqSuccess -ExpectedStatus "ok"
  Write-Host "PASS: success scenario"

  # 2) Delay path (verify minimum delay before response)
  $reqDelay = New-RequestId -Prefix "delay"
  $delayMs = 1800
  $delayStart = Get-Date
  $jobDelay = Start-ResponseSubscriber -Broker "emqx3" -Count 1 -TimeoutSec ($WaitSeconds + 4)
  Start-Sleep -Milliseconds 700
  Publish-Command -Broker "emqx1" -Payload @{
    requestId = $reqDelay
    carId = $CarId
    type = "diagnostic"
    simulate = @{
      mode = "delay"
      delayMs = $delayMs
    }
  }
  $resultDelay = Receive-SubscriberResult -Job $jobDelay
  $elapsedDelayMs = ((Get-Date) - $delayStart).TotalMilliseconds
  Assert-StructuredResponse -SubscriberResult $resultDelay -ExpectedRequestId $reqDelay -ExpectedStatus "ok"
  if ($elapsedDelayMs -lt ($delayMs - 150)) {
    throw "Delay scenario returned too quickly. Expected at least $delayMs ms, observed $elapsedDelayMs ms."
  }
  Write-Host "PASS: delay scenario"

  # 3) Error path
  $reqError = New-RequestId -Prefix "error"
  $jobError = Start-ResponseSubscriber -Broker "emqx1" -Count 1 -TimeoutSec $WaitSeconds
  Start-Sleep -Milliseconds 700
  Publish-Command -Broker "emqx2" -Payload @{
    requestId = $reqError
    carId = $CarId
    type = "diagnostic"
    simulate = @{
      mode = "error"
      errorCode = "OBD_TIMEOUT"
      message = "Simulated timeout from E2E."
    }
  }
  $resultError = Receive-SubscriberResult -Job $jobError
  Assert-StructuredResponse -SubscriberResult $resultError -ExpectedRequestId $reqError -ExpectedStatus "error" -ExpectedErrorCode "OBD_TIMEOUT"
  Write-Host "PASS: error scenario"

  # 4) Timeout path (no response expected)
  $reqTimeout = New-RequestId -Prefix "timeout"
  $jobTimeout = Start-ResponseSubscriber -Broker "emqx2" -Count 1 -TimeoutSec 5
  Start-Sleep -Milliseconds 700
  Publish-Command -Broker "emqx3" -Payload @{
    requestId = $reqTimeout
    carId = $CarId
    type = "diagnostic"
    simulate = @{
      mode = "timeout"
    }
  }
  $resultTimeout = Receive-SubscriberResult -Job $jobTimeout
  Assert-NoResponse -SubscriberResult $resultTimeout
  Write-Host "PASS: timeout scenario"

  # 5) Duplicate request protection
  $duplicateReqId = New-RequestId -Prefix "dup"
  $duplicatePayload = @{
    requestId = $duplicateReqId
    carId = $CarId
    type = "diagnostic"
    simulate = @{
      mode = "success"
    }
  }

  $jobFirstDup = Start-ResponseSubscriber -Broker "emqx1" -Count 1 -TimeoutSec $WaitSeconds
  Start-Sleep -Milliseconds 700
  Publish-Command -Broker "emqx2" -Payload $duplicatePayload
  $firstDupResult = Receive-SubscriberResult -Job $jobFirstDup
  Assert-StructuredResponse -SubscriberResult $firstDupResult -ExpectedRequestId $duplicateReqId -ExpectedStatus "ok"

  $jobSecondDup = Start-ResponseSubscriber -Broker "emqx1" -Count 1 -TimeoutSec 5
  Start-Sleep -Milliseconds 700
  Publish-Command -Broker "emqx3" -Payload $duplicatePayload
  $secondDupResult = Receive-SubscriberResult -Job $jobSecondDup
  Assert-NoResponse -SubscriberResult $secondDupResult
  Write-Host "PASS: duplicate request scenario"

  # 6) Explicit cross-node validation (publish emqx1, subscribe emqx3)
  $reqCrossNode = New-RequestId -Prefix "cross"
  $jobCross = Start-ResponseSubscriber -Broker "emqx3" -Count 1 -TimeoutSec $WaitSeconds
  Start-Sleep -Milliseconds 700
  Publish-Command -Broker "emqx1" -Payload @{
    requestId = $reqCrossNode
    carId = $CarId
    type = "diagnostic"
    simulate = @{
      mode = "success"
    }
  }
  $crossResult = Receive-SubscriberResult -Job $jobCross
  Assert-StructuredResponse -SubscriberResult $crossResult -ExpectedRequestId $reqCrossNode -ExpectedStatus "ok"
  Write-Host "PASS: cross-node scenario"

  Write-Host "PASS: All simulator E2E scenarios completed successfully."
}
finally {
  Pop-Location
}
