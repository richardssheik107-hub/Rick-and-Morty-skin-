[CmdletBinding()]
param(
  [int]$Port = 9335,
  [ValidatePattern('^[a-zA-Z0-9-]+$')]
  [string]$Theme = 'rick-portal',
  [ValidateRange(1, 30)]
  [int]$PollSeconds = 2,
  [switch]$LaunchAtStart
)

$ErrorActionPreference = 'Stop'
$StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$GuardianStatePath = Join-Path $StateRoot 'guardian-state.json'
$GuardianLogPath = Join-Path $StateRoot 'guardian.log'
$StartScript = Join-Path $PSScriptRoot 'start-dream-skin.ps1'
$PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null

function Write-GuardianLog([string]$Message) {
  "$(Get-Date -Format o) $Message" | Add-Content -LiteralPath $GuardianLogPath -Encoding utf8
}

function Test-CodexDebugPort {
  try {
    $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json/list" -TimeoutSec 1
    return [bool]($targets | Where-Object { $_.type -eq 'page' -and $_.url -like 'app://*' })
  } catch {
    return $false
  }
}

$mutex = [System.Threading.Mutex]::new($false, "Local\CodexDreamSkinGuardian-$Port")
if (-not $mutex.WaitOne(0)) {
  $mutex.Dispose()
  exit 0
}

try {
  @{
    guardianPid = $PID
    port = $Port
    theme = $Theme
    startedAt = (Get-Date).ToString('o')
  } | ConvertTo-Json | Set-Content -LiteralPath $GuardianStatePath -Encoding utf8
  Write-GuardianLog "Guardian started theme=$Theme port=$Port launchAtStart=$LaunchAtStart"

  $launchRequested = [bool]$LaunchAtStart
  $unskinnedObservations = 0
  $handledProcessId = $null
  while ($true) {
    if (Test-CodexDebugPort) {
      $launchRequested = $false
      $unskinnedObservations = 0
      $handledProcessId = $null
      Start-Sleep -Seconds $PollSeconds
      continue
    }

    $unskinnedProcess = Get-Process ChatGPT -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 } |
      Select-Object -First 1
    if (-not $unskinnedProcess) {
      $unskinnedObservations = 0
      $handledProcessId = $null
      Start-Sleep -Seconds $PollSeconds
      continue
    }
    if ($handledProcessId -eq $unskinnedProcess.Id) {
      Start-Sleep -Seconds $PollSeconds
      continue
    }
    $unskinnedObservations += 1

    # Three observations avoid interfering with the short startup interval
    # before a correctly launched Codex exposes its debugging endpoint.
    if ($launchRequested -or $unskinnedObservations -ge 3) {
      $reason = if ($launchRequested) { 'Windows sign-in' } else { 'official Codex icon launch detected' }
      Write-GuardianLog "Starting themed Codex after $reason"
      # Mark this instance before launching. A failed conversion must never
      # create a close/reopen loop for the same visible Codex process.
      $handledProcessId = $unskinnedProcess.Id
      $arguments = @(
        '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
        '-File', "`"$StartScript`"", '-Port', "$Port", '-Theme', "`"$Theme`"",
        '-WaitForNetwork', '-RestartExisting'
      )
      $child = Start-Process -FilePath $PowerShell -ArgumentList $arguments -WindowStyle Hidden -PassThru
      # Start-Process -Wait also waits for descendant processes on Windows.
      # The launcher intentionally creates a long-running Node injector, so
      # wait only for the launcher process itself or the guardian would stop
      # monitoring while the themed app is open.
      $child.WaitForExit()
      Write-GuardianLog "Theme launcher exited code=$($child.ExitCode)"
      $launchRequested = $false
      $unskinnedObservations = 0
      if ($child.ExitCode -ne 0) {
        $remaining = Get-Process ChatGPT -ErrorAction SilentlyContinue |
          Where-Object { $_.MainWindowHandle -ne 0 } |
          Select-Object -First 1
        if ($remaining) { $handledProcessId = $remaining.Id }
        Write-GuardianLog "Conversion failed; guardian is exiting to guarantee that Codex is not restarted again"
        break
      }
    }

    Start-Sleep -Seconds $PollSeconds
  }
} catch {
  Write-GuardianLog "ERROR $($_.Exception.Message)"
  throw
} finally {
  try { $mutex.ReleaseMutex() } catch {}
  $mutex.Dispose()
}
