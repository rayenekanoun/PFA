param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("diagnostic", "capabilities")]
  [string]$Type,

  [Parameter(Mandatory = $true)]
  [string]$DeviceId,

  [Parameter(Mandatory = $true)]
  [string]$CarId,

  [Parameter(Mandatory = $true)]
  [string]$RequestId,

  [string]$PlanId,

  [ValidateSet("ok", "error")]
  [string]$Status = "ok",

  [ValidateSet("overheating", "rough_idle", "fuel_rich")]
  [string]$ProfilePreset = "rough_idle",

  [string[]]$SupportWindows = @("0100", "0120", "0140", "0160", "0200", "0500", "0600", "0900"),

  [string[]]$SupportedPidCodes = @("010C", "010D", "0105", "0110", "0142"),

  [string]$ErrorCode = "MANUAL_RESPONSE",
  [string]$ErrorMessage = "Manual device response from terminal.",

  [switch]$NoDtcs,

  [ValidateSet("emqx1", "emqx2", "emqx3")]
  [string]$Broker = "emqx1"
)

$ErrorActionPreference = "Stop"
$clusterRoot = Split-Path -Parent $PSScriptRoot

function Get-ProfileMeasurements {
  param([string]$Preset)

  switch ($Preset) {
    "overheating" {
      return @(
        @{
          mode = "01"
          pid = "05"
          key = "coolant_temp_c"
          label = "Coolant Temperature"
          unit = "C"
          status = "ok"
          raw = "7B"
          decoded = 83
        },
        @{
          mode = "01"
          pid = "67"
          key = "coolant_temp_sensor_2_c"
          label = "Coolant Temp Sensor 2"
          unit = "C"
          status = "ok"
          raw = "79"
          decoded = 81
        },
        @{
          mode = "01"
          pid = "5C"
          key = "engine_oil_temp_c"
          label = "Engine Oil Temperature"
          unit = "C"
          status = "ok"
          raw = "87"
          decoded = 95
        },
        @{
          mode = "01"
          pid = "10"
          key = "maf_g_s"
          label = "Mass Air Flow"
          unit = "g/s"
          status = "ok"
          raw = "0C"
          decoded = 12.4
        }
      )
    }
    "fuel_rich" {
      return @(
        @{
          mode = "01"
          pid = "06"
          key = "short_term_fuel_trim_bank1"
          label = "STFT Bank 1"
          unit = "%"
          status = "ok"
          raw = "9A"
          decoded = 20.3
        },
        @{
          mode = "01"
          pid = "07"
          key = "long_term_fuel_trim_bank1"
          label = "LTFT Bank 1"
          unit = "%"
          status = "ok"
          raw = "90"
          decoded = 12.5
        },
        @{
          mode = "01"
          pid = "14"
          key = "o2_sensor_b1s1"
          label = "O2 Sensor B1S1"
          unit = "V"
          status = "ok"
          raw = "D4"
          decoded = 0.91
        },
        @{
          mode = "01"
          pid = "10"
          key = "maf_g_s"
          label = "Mass Air Flow"
          unit = "g/s"
          status = "ok"
          raw = "12"
          decoded = 18.8
        }
      )
    }
    default {
      return @(
        @{
          mode = "01"
          pid = "0C"
          key = "engine_rpm"
          label = "Engine RPM"
          unit = "rpm"
          status = "ok"
          raw = "0B B8"
          decoded = 750
        },
        @{
          mode = "01"
          pid = "04"
          key = "engine_load"
          label = "Engine Load"
          unit = "%"
          status = "ok"
          raw = "22"
          decoded = 13.3
        },
        @{
          mode = "01"
          pid = "0B"
          key = "intake_manifold_pressure_kpa"
          label = "Intake Manifold Pressure"
          unit = "kPa"
          status = "ok"
          raw = "20"
          decoded = 32
        },
        @{
          mode = "01"
          pid = "42"
          key = "control_module_voltage_v"
          label = "Control Module Voltage"
          unit = "V"
          status = "ok"
          raw = "37 70"
          decoded = 13.9
        }
      )
    }
  }
}

function Get-ProfileDtcs {
  param(
    [string]$Preset,
    [bool]$SkipDtcs
  )

  if ($SkipDtcs) {
    return @()
  }

  switch ($Preset) {
    "overheating" {
      return @(
        @{
          code = "P0217"
          description = "Engine Over Temperature Condition"
          severity = "high"
          state = "stored"
          sourceMode = "03"
        }
      )
    }
    "fuel_rich" {
      return @(
        @{
          code = "P0172"
          description = "System Too Rich Bank 1"
          severity = "medium"
          state = "stored"
          sourceMode = "03"
        }
      )
    }
    default {
      return @(
        @{
          code = "P0507"
          description = "Idle Control System RPM Higher Than Expected"
          severity = "medium"
          state = "stored"
          sourceMode = "03"
        }
      )
    }
  }
}

if ($Type -eq "diagnostic" -and [string]::IsNullOrWhiteSpace($PlanId)) {
  throw "PlanId is required for diagnostic responses."
}

$generatedAt = [DateTime]::UtcNow.ToString("o")

if ($Type -eq "capabilities") {
  $topic = "devices/$DeviceId/telemetry/capabilities/response"
  if ($Status -eq "ok") {
    $payload = @{
      requestId = $RequestId
      deviceId = $DeviceId
      carId = $CarId
      generatedAt = $generatedAt
      status = "ok"
      supportedPidCodes = $SupportedPidCodes
      supportWindows = $SupportWindows
    }
  }
  else {
    $payload = @{
      requestId = $RequestId
      deviceId = $DeviceId
      carId = $CarId
      generatedAt = $generatedAt
      status = "error"
      supportedPidCodes = @()
      supportWindows = $SupportWindows
      error = @{
        code = $ErrorCode
        message = $ErrorMessage
      }
    }
  }
}
else {
  $topic = "devices/$DeviceId/telemetry/diagnostic/response"
  if ($Status -eq "ok") {
    $payload = @{
      requestId = $RequestId
      planId = $PlanId
      deviceId = $DeviceId
      carId = $CarId
      generatedAt = $generatedAt
      status = "ok"
      measurements = @(Get-ProfileMeasurements -Preset $ProfilePreset)
      dtcs = @(Get-ProfileDtcs -Preset $ProfilePreset -SkipDtcs $NoDtcs.IsPresent)
    }
  }
  else {
    $payload = @{
      requestId = $RequestId
      planId = $PlanId
      deviceId = $DeviceId
      carId = $CarId
      generatedAt = $generatedAt
      status = "error"
      measurements = @()
      dtcs = @()
      error = @{
        code = $ErrorCode
        message = $ErrorMessage
      }
    }
  }
}

Push-Location $clusterRoot
try {
  $json = $payload | ConvertTo-Json -Depth 8 -Compress
  $base64Payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
  $publishCmd = "echo '$base64Payload' | base64 -d | mosquitto_pub -h $Broker -p 1883 -q 2 -t '$topic' -s"
  docker compose exec -T mqtt-tools sh -lc $publishCmd
  Write-Host "Published manual $Type response to '$topic'."
  Write-Host $json
}
finally {
  Pop-Location
}
