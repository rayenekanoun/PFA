param(
  [switch]$SkipBackendInstall,
  [switch]$NoBackendBuild,
  [switch]$SkipFrontendInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptsDir = $PSScriptRoot

& (Join-Path $scriptsDir "start-all.ps1") `
  -SkipInstall:$SkipBackendInstall `
  -NoBuild:$NoBackendBuild

& (Join-Path $scriptsDir "start-frontend.ps1") `
  -SkipInstall:$SkipFrontendInstall
