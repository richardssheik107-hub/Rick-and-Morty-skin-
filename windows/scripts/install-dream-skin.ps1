[CmdletBinding()]
param(
  [int]$Port = 9335,
  [ValidatePattern('^[a-zA-Z0-9-]+$')]
  [string]$Theme = 'rick-portal',
  [switch]$NoShortcuts,
  [switch]$NoAutoStart
)

$ErrorActionPreference = 'Stop'
$SkillRoot = Split-Path -Parent $PSScriptRoot
$StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$GuardianStatePath = Join-Path $StateRoot 'guardian-state.json'
New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null
$ConfigPath = Join-Path $HOME '.codex\config.toml'
$BackupPath = Join-Path $StateRoot 'config.before-dream-skin.toml'
if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "Codex config not found: $ConfigPath" }
if (-not (Test-Path -LiteralPath $BackupPath)) { Copy-Item -LiteralPath $ConfigPath -Destination $BackupPath }

$content = Get-Content -LiteralPath $ConfigPath -Raw
if ($Theme -eq 'dream') {
  $desktopMatch = [regex]::Match($content, '(?ms)^\[desktop\]\s*\r?\n(?<body>.*?)(?=^\[|\z)')
  if (-not $desktopMatch.Success) {
    $content = $content.TrimEnd() + "`r`n`r`n[desktop]`r`n"
    $desktopMatch = [regex]::Match($content, '(?ms)^\[desktop\]\s*\r?\n(?<body>.*?)(?=^\[|\z)')
  }
  $body = $desktopMatch.Groups['body'].Value
  $settings = [ordered]@{
    appearanceTheme = 'appearanceTheme = "light"'
    appearanceLightCodeThemeId = 'appearanceLightCodeThemeId = "codex"'
    appearanceLightChromeTheme = 'appearanceLightChromeTheme = { accent = "#B65CFF", contrast = 64, fonts = { code = "Cascadia Code", ui = "Microsoft YaHei UI" }, ink = "#4A235F", opaqueWindows = true, semanticColors = { diffAdded = "#BCE8CF", diffRemoved = "#F7B8CE", skill = "#C47BFF" }, surface = "#FFF4FA" }'
  }
  foreach ($key in $settings.Keys) {
    $pattern = "(?m)^$([regex]::Escape($key))\s*=.*$"
    if ([regex]::IsMatch($body, $pattern)) { $body = [regex]::Replace($body, $pattern, $settings[$key]) }
    else { $body = $body.TrimEnd() + "`r`n" + $settings[$key] + "`r`n" }
  }
  $content = $content.Substring(0, $desktopMatch.Groups['body'].Index) + $body + $content.Substring($desktopMatch.Groups['body'].Index + $desktopMatch.Groups['body'].Length)
  Set-Content -LiteralPath $ConfigPath -Value $content -Encoding utf8
}

if (-not $NoShortcuts) {
  $shell = New-Object -ComObject WScript.Shell
  $desktop = [Environment]::GetFolderPath('Desktop')
  $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
  $startup = Join-Path $startMenu 'Startup'
  $powershell = (Get-Command powershell.exe).Source
  $startScript = Join-Path $PSScriptRoot 'start-dream-skin.ps1'
  $watchScript = Join-Path $PSScriptRoot 'watch-dream-skin.ps1'
  $restoreScript = Join-Path $PSScriptRoot 'restore-dream-skin.ps1'
  $nativeLauncher = Join-Path $SkillRoot 'bin\CodexDreamSkinLauncher.exe'
  $package = Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
  $codexIcon = if ($package) { Join-Path $package.InstallLocation 'app\ChatGPT.exe' } else { '' }
  foreach ($folder in @($desktop, $startMenu)) {
    foreach ($shortcutName in @('Codex.lnk', 'Codex Dream Skin.lnk')) {
      $shortcut = $shell.CreateShortcut((Join-Path $folder $shortcutName))
      if (Test-Path -LiteralPath $nativeLauncher) {
        $shortcut.TargetPath = $nativeLauncher
        $shortcut.Arguments = "-Port $Port -Theme `"$Theme`""
      } else {
        $shortcut.TargetPath = $powershell
        $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`" -Port $Port -Theme `"$Theme`" -WaitForNetwork -RestartExisting"
      }
      $shortcut.WorkingDirectory = $SkillRoot
      $shortcut.Description = "Launch Codex with the '$Theme' interface theme"
      if ($codexIcon -and (Test-Path -LiteralPath $codexIcon)) { $shortcut.IconLocation = "$codexIcon,0" }
      $shortcut.Save()
    }
  }
  $restore = $shell.CreateShortcut((Join-Path $desktop 'Codex Dream Skin - Restore.lnk'))
  $restore.TargetPath = $powershell
  $restore.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$restoreScript`" -Port $Port"
  $restore.WorkingDirectory = $SkillRoot
  $restore.Description = 'Remove the live Codex Dream Skin'
  $restore.Save()

  if (-not $NoAutoStart) {
    $autoStart = $shell.CreateShortcut((Join-Path $startup 'Codex Dream Skin - Auto Start.lnk'))
    $autoStart.TargetPath = $powershell
    $autoStart.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watchScript`" -Port $Port -Theme `"$Theme`" -LaunchAtStart"
    $autoStart.WorkingDirectory = $SkillRoot
    $autoStart.Description = "Keep Codex on the '$Theme' skin, including launches from the official icon"
    $autoStart.WindowStyle = 7
    $autoStart.Save()
  } else {
    Remove-Item -LiteralPath (Join-Path $startup 'Codex Dream Skin - Auto Start.lnk') -Force -ErrorAction SilentlyContinue
  }
}

if (-not $NoShortcuts) {
  if (Test-Path -LiteralPath $GuardianStatePath) {
    try {
      $oldGuardianState = Get-Content -LiteralPath $GuardianStatePath -Raw | ConvertFrom-Json
      if ($oldGuardianState.guardianPid) {
        $oldGuardian = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$oldGuardianState.guardianPid)" -ErrorAction SilentlyContinue
        if ($oldGuardian.CommandLine -match 'watch-dream-skin\.ps1' -and $oldGuardian.CommandLine -match 'Codex-Dream-Skin') {
          Stop-Process -Id ([int]$oldGuardianState.guardianPid) -Force -ErrorAction SilentlyContinue
        }
      }
    } catch {}
  }
  if (-not $NoAutoStart) {
    $guardianArguments = @(
      '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
      '-File', "`"$watchScript`"", '-Port', "$Port", '-Theme', "`"$Theme`""
    )
    Start-Process -FilePath $powershell -ArgumentList $guardianArguments -WindowStyle Hidden | Out-Null
  }
}

$autoStartStatus = if ($NoAutoStart -or $NoShortcuts) { 'disabled' } else { 'enabled' }
Write-Host "Codex Dream Skin installed with default theme '$Theme'. Auto-start is $autoStartStatus."
