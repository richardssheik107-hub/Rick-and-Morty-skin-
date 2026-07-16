[CmdletBinding()]
param(
  [int]$Port = 9335,
  [ValidatePattern('^[a-zA-Z0-9-]+$')]
  [string]$Theme = 'rick-portal',
  [string]$ScreenshotPath,
  [ValidatePattern('^\d+x\d+$')]
  [string]$WindowSize
)

$ErrorActionPreference = 'Stop'
$node = (Get-Command node -ErrorAction Stop).Source
$injector = Join-Path $PSScriptRoot 'injector.mjs'
$arguments = @($injector, '--verify', '--port', "$Port", '--theme', $Theme)
if ($ScreenshotPath) { $arguments += @('--screenshot', $ScreenshotPath) }
if ($WindowSize) { $arguments += @('--window-size', $WindowSize) }
& $node @arguments
exit $LASTEXITCODE
