[CmdletBinding()]
param(
  [int]$Port = 9335,
  [switch]$Uninstall,
  [switch]$RestoreBaseTheme
)

$ErrorActionPreference = 'Stop'
$node = (Get-Command node -ErrorAction Stop).Source
$injector = Join-Path $PSScriptRoot 'injector.mjs'
$StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$StatePath = Join-Path $StateRoot 'state.json'
$GuardianStatePath = Join-Path $StateRoot 'guardian-state.json'

if (Test-Path -LiteralPath $GuardianStatePath) {
  try {
    $guardianState = Get-Content -LiteralPath $GuardianStatePath -Raw | ConvertFrom-Json
    if ($guardianState.guardianPid) {
      $guardian = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$guardianState.guardianPid)" -ErrorAction SilentlyContinue
      if ($guardian.CommandLine -match 'watch-dream-skin\.ps1' -and $guardian.CommandLine -match 'Codex-Dream-Skin') {
        Stop-Process -Id ([int]$guardianState.guardianPid) -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}
  Remove-Item -LiteralPath $GuardianStatePath -Force -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath $StatePath) {
  try {
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    if ($state.injectorPid) {
      $injectorProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$state.injectorPid)" -ErrorAction SilentlyContinue
      if ($injectorProcess.CommandLine -match 'injector\.mjs' -and $injectorProcess.CommandLine -match 'Codex-Dream-Skin') {
        Stop-Process -Id ([int]$state.injectorPid) -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}
  Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 250
try { & $node $injector --remove --port $Port --timeout-ms 3000 } catch {}

if ($Uninstall) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
  $startup = Join-Path $startMenu 'Startup'
  Remove-Item -LiteralPath (Join-Path $desktop 'Codex Dream Skin.lnk') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $desktop 'Codex.lnk') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $desktop 'Codex Dream Skin - Restore.lnk') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $startMenu 'Codex Dream Skin.lnk') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $startMenu 'Codex.lnk') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $startup 'Codex Dream Skin - Auto Start.lnk') -Force -ErrorAction SilentlyContinue
}

if ($RestoreBaseTheme) {
  $backup = Join-Path $StateRoot 'config.before-dream-skin.toml'
  $config = Join-Path $HOME '.codex\config.toml'
  if (-not (Test-Path -LiteralPath $backup)) { throw 'No pre-install config backup is available.' }
  $backupContent = Get-Content -LiteralPath $backup -Raw
  $currentContent = Get-Content -LiteralPath $config -Raw
  foreach ($key in @('appearanceTheme', 'appearanceLightCodeThemeId', 'appearanceLightChromeTheme')) {
    $pattern = "(?m)^$([regex]::Escape($key))\s*=.*(?:\r?\n)?"
    $saved = [regex]::Match($backupContent, $pattern)
    if ([regex]::IsMatch($currentContent, $pattern)) {
      $replacement = if ($saved.Success) { $saved.Value.TrimEnd("`r", "`n") + "`r`n" } else { '' }
      $currentContent = [regex]::Replace($currentContent, $pattern, $replacement, 1)
    } elseif ($saved.Success) {
      $desktop = [regex]::Match($currentContent, '(?ms)^\[desktop\]\s*\r?\n(?<body>.*?)(?=^\[|\z)')
      if (-not $desktop.Success) {
        $currentContent = $currentContent.TrimEnd() + "`r`n`r`n[desktop]`r`n"
        $desktop = [regex]::Match($currentContent, '(?ms)^\[desktop\]\s*\r?\n(?<body>.*?)(?=^\[|\z)')
      }
      $body = $desktop.Groups['body'].Value.TrimEnd() + "`r`n" + $saved.Value.TrimEnd("`r", "`n") + "`r`n"
      $currentContent = $currentContent.Substring(0, $desktop.Groups['body'].Index) + $body +
        $currentContent.Substring($desktop.Groups['body'].Index + $desktop.Groups['body'].Length)
    }
  }
  Set-Content -LiteralPath $config -Value $currentContent -Encoding utf8
}

Write-Host 'The live Dream Skin was removed.'
