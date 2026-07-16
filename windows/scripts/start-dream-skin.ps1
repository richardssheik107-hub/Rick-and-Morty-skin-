[CmdletBinding()]
param(
  [int]$Port = 9335,
  [ValidatePattern('^[a-zA-Z0-9-]+$')]
  [string]$Theme = 'rick-portal',
  [switch]$RestartExisting,
  [string]$ProfilePath,
  [switch]$WaitForNetwork,
  [ValidateRange(30, 3600)]
  [int]$NetworkTimeoutSeconds = 900,
  [switch]$ForegroundInjector
)

$ErrorActionPreference = 'Stop'
$SkillRoot = Split-Path -Parent $PSScriptRoot
$Injector = Join-Path $PSScriptRoot 'injector.mjs'
$StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$StatePath = Join-Path $StateRoot 'state.json'
$StdoutPath = Join-Path $StateRoot 'injector.log'
$StderrPath = Join-Path $StateRoot 'injector-error.log'
$LauncherLogPath = Join-Path $StateRoot 'launcher.log'
New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null

if (-not $ProfilePath) {
  # Chromium 136+ ignores remote-debugging switches on the default data directory.
  # Keep a persistent, non-default profile so CDP remains available across launches.
  $ProfilePath = Join-Path $StateRoot 'profile'
}

function Write-LauncherLog([string]$Message) {
  "$(Get-Date -Format o) $Message" | Add-Content -LiteralPath $LauncherLogPath -Encoding utf8
}

$launcherMutex = $null
$launcherMutexAcquired = $false

trap {
  if ($launcherMutexAcquired -and $launcherMutex) {
    try { $launcherMutex.ReleaseMutex() } catch {}
  }
  if ($launcherMutex) { $launcherMutex.Dispose() }
  Write-LauncherLog "ERROR $($_.Exception.Message)"
  [Console]::Error.WriteLine($_.ToString())
  exit 1
}

Write-LauncherLog "Starting theme=$Theme port=$Port profile=$ProfilePath restartExisting=$RestartExisting"

function Test-CodexDebugPort([int]$CandidatePort) {
  try {
    $targets = Invoke-RestMethod "http://127.0.0.1:$CandidatePort/json/list" -TimeoutSec 1
    return [bool]($targets | Where-Object { $_.type -eq 'page' -and $_.url -like 'app://*' })
  } catch {
    return $false
  }
}

function Test-ThemeNetworkReady {
  try {
    # Use WinHTTP/Internet settings so VPN and system-proxy configurations are
    # respected. Any HTTP response proves that the route is available; the
    # unauthenticated auth endpoint commonly responds with 403, which is fine.
    Invoke-WebRequest `
      -Uri 'https://auth.openai.com/' `
      -Method Head `
      -UseBasicParsing `
      -TimeoutSec 8 `
      -ErrorAction Stop | Out-Null
    return $true
  } catch {
    if ($_.Exception.Response) { return $true }
    return $false
  }
}

function Start-PackagedCodex($Package, [string[]]$Arguments) {
  if (-not ('CodexDreamSkin.PackagedAppLauncher' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace CodexDreamSkin {
  [Flags] public enum ActivateOptions { None = 0 }
  [ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
  public class ApplicationActivationManagerClass { }
  [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IApplicationActivationManager {
    [PreserveSig]
    int ActivateApplication(
      [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
      [MarshalAs(UnmanagedType.LPWStr)] string arguments,
      ActivateOptions options,
      out uint processId);
  }
  public static class PackagedAppLauncher {
    public static uint Launch(string appUserModelId, string arguments) {
      var manager = (IApplicationActivationManager)new ApplicationActivationManagerClass();
      uint processId;
      int result = manager.ActivateApplication(appUserModelId, arguments, ActivateOptions.None, out processId);
      Marshal.ThrowExceptionForHR(result);
      return processId;
    }
  }
}
'@
  }
  $quotedArguments = $Arguments | ForEach-Object {
    if ($_ -match '[\s"]') { '"' + ($_.Replace('"', '\"')) + '"' } else { $_ }
  }
  $argumentString = $quotedArguments -join ' '
  $appUserModelId = "$($Package.PackageFamilyName)!App"
  return [CodexDreamSkin.PackagedAppLauncher]::Launch($appUserModelId, $argumentString)
}

$launcherMutex = [System.Threading.Mutex]::new($false, "Local\CodexDreamSkinLauncher-$Port")
$launcherMutexAcquired = $launcherMutex.WaitOne(0)
if (-not $launcherMutexAcquired) {
  Write-LauncherLog "Another launcher owns port $Port; waiting for its CDP endpoint"
  $companionDeadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $companionDeadline) {
    if (Test-CodexDebugPort $Port) {
      $launcherMutex.Dispose()
      Write-LauncherLog "Existing launcher made port $Port ready; exiting duplicate launch"
      exit 0
    }
    Start-Sleep -Seconds 2
  }
  throw "Another Codex Dream Skin launch is still running, but port $Port did not become ready."
}

$node = (Get-Command node -ErrorAction Stop).Source
$debugReady = Test-CodexDebugPort $Port
$mainProcesses = @(Get-Process ChatGPT -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 })

if ($WaitForNetwork -and -not $debugReady) {
  Write-LauncherLog "Waiting for VPN/system-proxy access to auth.openai.com"
  $networkDeadline = (Get-Date).AddSeconds($NetworkTimeoutSeconds)
  $networkAttempt = 0
  while (-not (Test-ThemeNetworkReady)) {
    $networkAttempt += 1
    if ((Get-Date) -ge $networkDeadline) {
      throw "VPN/network did not become ready within $NetworkTimeoutSeconds seconds."
    }
    if (($networkAttempt % 6) -eq 0) { Write-LauncherLog "VPN/network still unavailable; continuing to wait" }
    Start-Sleep -Seconds 5
  }
  Write-LauncherLog "VPN/network is ready"
}

if (-not $debugReady -and $mainProcesses.Count -gt 0) {
  if (-not $RestartExisting) {
    throw "Codex is already running without dream-skin debugging on port $Port. Close Codex or rerun with -RestartExisting."
  }
  Write-LauncherLog "Closing an unskinned Codex instance before themed relaunch"
  foreach ($process in $mainProcesses) { [void]$process.CloseMainWindow() }
  Start-Sleep -Seconds 3
  foreach ($process in $mainProcesses) {
    if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
  # Clear accessible Electron helpers so their single-instance lock cannot
  # swallow the relaunch arguments. Protected crash helpers are harmless and
  # any access-denied result must not fail the launch.
  Get-Process ChatGPT -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

if (-not (Test-CodexDebugPort $Port)) {
  $package = Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
  if (-not $package) { throw 'The OpenAI.Codex Store package is not installed.' }
  $exe = Join-Path $package.InstallLocation 'app\ChatGPT.exe'
  if (-not (Test-Path -LiteralPath $exe)) { throw "Codex executable not found: $exe" }
  $arguments = @("--remote-debugging-port=$Port")
  if ($ProfilePath) {
    New-Item -ItemType Directory -Force -Path $ProfilePath | Out-Null
    $arguments += "--user-data-dir=$ProfilePath"
  }
  $arguments += '--remote-debugging-address=127.0.0.1'
  Write-LauncherLog "Activating $($package.PackageFamilyName)!App with $($arguments -join ' ')"
  $activatedPid = Start-PackagedCodex $package $arguments
  Write-LauncherLog "Packaged app activation returned pid $activatedPid"
}

$deadline = (Get-Date).AddSeconds(60)
while (-not (Test-CodexDebugPort $Port)) {
  if ((Get-Date) -ge $deadline) { throw "Codex did not expose CDP on port $Port within 60 seconds." }
  Start-Sleep -Milliseconds 400
}

if (Test-Path -LiteralPath $StatePath) {
  try {
    $old = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    if ($old.injectorPid) {
      $oldInjector = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$old.injectorPid)" -ErrorAction SilentlyContinue
      if ($oldInjector.CommandLine -match 'injector\.mjs' -and $oldInjector.CommandLine -match 'Codex-Dream-Skin') {
        Stop-Process -Id ([int]$old.injectorPid) -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}
}

if ($ForegroundInjector) {
  & $node $Injector --watch --port $Port --theme $Theme
  exit $LASTEXITCODE
}

$injectorArgs = @("`"$Injector`"", '--watch', '--port', "$Port", '--theme', "$Theme")
$daemon = Start-Process -FilePath $node -ArgumentList $injectorArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput $StdoutPath -RedirectStandardError $StderrPath
@{
  port = $Port
  injectorPid = $daemon.Id
  startedAt = (Get-Date).ToString('o')
  skillRoot = $SkillRoot
  profilePath = $ProfilePath
  theme = $Theme
} | ConvertTo-Json | Set-Content -LiteralPath $StatePath -Encoding utf8

$verified = $false
for ($attempt = 0; $attempt -lt 45; $attempt++) {
  Start-Sleep -Milliseconds 700
  & $node $Injector --verify --port $Port --theme $Theme *> $null
  if ($LASTEXITCODE -eq 0) { $verified = $true; break }
}
if (-not $verified) { throw 'Dream skin launched but verification failed. See injector logs.' }
Write-LauncherLog "Theme $Theme verified on port $Port with injector pid $($daemon.Id)"
if ($launcherMutexAcquired -and $launcherMutex) {
  $launcherMutex.ReleaseMutex()
  $launcherMutexAcquired = $false
}
if ($launcherMutex) { $launcherMutex.Dispose() }
Write-Host "Codex Dream Skin theme '$Theme' is active on port $Port."
