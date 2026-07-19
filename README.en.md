# Codex Dream Skin

> Windows `rick-portal` theme `1.6.0-preview.10`: full deep-space work art, a separate character foreground, a naturally animated green portal, native dark-teal controls, and a reversible CDP injection flow.

<p align="center">
  <a href="./README.md">中文</a> · <strong>English</strong>
</p>

<p align="center">
  <strong>Give Codex a face that breathes.</strong><br>
  External themes for the Codex desktop app · Local CDP inject · No official package mutation
</p>

<p align="center">
  One image, one mood · Code with atmosphere
</p>

<p align="center">
  Unofficial. Does not modify <code>.app</code> / <code>app.asar</code> / WindowsApps.
</p>

## Sponsors

<p align="center">
  <a href="https://passion8.cc/register?aff=TuPe">
    <img src="docs/images/sponsor-passion8.png" alt="Passion8" height="72">
  </a>
</p>

<p align="center">
  <strong>Smarter Connections · Passionate Creation</strong><br>
  <sub>Connect AI · Power Creation</sub>
</p>

<p align="center">
  Thanks to <a href="https://passion8.cc/register?aff=TuPe"><strong>passion8.cc</strong></a> for sponsoring this project.<br>
  Full-power AI gateway: official models, no silent downgrades, no wrapper shells.<br>
  One-line setup for Codex / Claude Code / Grok.
</p>

<p align="center">
  <sub>
    Theme install and API config stay separate — this project never rewrites your provider settings.
  </sub>
</p>

## Gallery

One image, one mood. Real theme previews you can ship:

<p align="center">
  <img src="docs/images/gallery/skin-01.jpg" alt="Pink Custom" width="900"><br>
  <sub>Pink Custom</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-02.jpg" alt="God of Wealth" width="900"><br>
  <sub>God of Wealth</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-03.jpg" alt="Red-White Sci-Fi" width="900"><br>
  <sub>Red-White Sci-Fi</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-04.jpg" alt="Clear Custom" width="900"><br>
  <sub>Clear Custom</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-05.jpg" alt="Inspiration" width="900"><br>
  <sub>Inspiration</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-06.jpg" alt="Purple Night" width="900"><br>
  <sub>Purple Night</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-07.jpg" alt="Hatsune Miku" width="900"><br>
  <sub>Hatsune Miku</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-08.jpg" alt="Stage Black-Gold" width="900"><br>
  <sub>Stage Black-Gold</sub>
</p>

## What it does

- **Real UI** — Sidebar, cards, project picker, and input stay native. Not a fake full-window screenshot.
- **Swappable art** — Drop in an image you like and it becomes your theme.
- **Restorable** — One-click restore to the stock look.
- **Safer path** — Local-loopback CDP inject only. No official binary or signature changes.

## Quick start

Platform scripts are ready — different plumbing, same goal: theme Codex.

| Platform | Dir | Entry |
|------|------|------|
| Apple Silicon / Intel Mac | [`macos/`](./macos/) | Double-click `Install Codex Dream Skin.command` |
| Windows | [`windows/`](./windows/) | `scripts/install-dream-skin.ps1` → `start-dream-skin.ps1` |

More detail:

- Mac: [`macos/README.md`](./macos/README.md)
- Windows: [`windows/SKILL.md`](./windows/SKILL.md)
- Paths: [`docs/platforms.md`](./docs/platforms.md)
- Project notes: [`docs/PROJECT.md`](./docs/PROJECT.md)

### Direct Windows deployment

Requirements: Windows 10/11, the signed-in Microsoft Store Codex app, PowerShell 5.1+, Node.js 18+, and Git.

Until the preview is merged into `main`, clone the deployable theme branch directly:

```powershell
git clone --branch agent/animated-portal-v1.6.0-preview --single-branch https://github.com/richardssheik107-hub/Rick-and-Morty-skin-.git
Set-Location .\Rick-and-Morty-skin-
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\scripts\install-dream-skin.ps1 -Port 9347 -Theme rick-portal
.\windows\bin\CodexDreamSkinLauncher.exe -Port 9347 -Theme rick-portal
```

Verify the live UI and animation:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\scripts\verify-dream-skin.ps1 -Port 9347 -Theme rick-portal
```

`"pass": true` confirms the sidebar, composer, art layers, animated portal, and layout checks.

### Taskbar pinning

Unpin the official Codex/ChatGPT icon, search the Start menu for **Codex Dream Skin**, and pin that search result directly. Do not pin the running window: Windows will pin the official app AUMID and bypass the theme launcher.

### Troubleshooting learned during development

- **Taskbar opens the stock UI:** check `%LOCALAPPDATA%\CodexDreamSkin\launcher.log`. No new entry means the official shortcut was used.
- **Store update breaks injection:** rerun `install-dream-skin.ps1` to refresh shortcuts. The launcher discovers the newest package automatically.
- **CDP port looks unavailable:** new Store builds may bind `::1` while an older process owns `127.0.0.1`. The current launcher, Guardian, and injector probe both loopback families.
- **VPN/Clash keeps reconnecting:** enable the Windows system proxy and verify its local port. The launcher uses the same detected proxy for readiness checks, Chromium, and Codex helpers without writing a permanent machine-wide override.
- **Repeated close/reopen:** Guardian converts an unthemed official launch once. Current process tracking and dual-stack CDP checks prevent the earlier conversion loop.
- **Theme disappears after navigation:** keep Guardian and the Node injector alive; both are repaired by launching the themed shortcut again.

Useful diagnostics:

```powershell
Get-Content "$env:LOCALAPPDATA\CodexDreamSkin\launcher.log" -Tail 40
Get-NetTCPConnection -State Listen -LocalPort 9347
Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' | Select-Object ProxyEnable,ProxyServer
```

Restore or uninstall:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\scripts\restore-dream-skin.ps1 -Port 9347
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\scripts\restore-dream-skin.ps1 -Port 9347 -Uninstall -RestoreBaseTheme
```

## Feedback & contributions

- **Issues:** Use the [issue templates](./.github/ISSUE_TEMPLATE/) (bug / feature). Blank issues are disabled. Please try Verify / Restore self-checks before filing bugs.
- **PRs:** Follow the [PR template](./.github/pull_request_template.md) — describe the change and tick the self-checks you actually ran (e.g. `macos/tests/run-tests.sh`, verify / restore).

## Safety

- CDP binds to local IPv4/IPv6 loopback only — avoid untrusted local processes while the theme runs.
- Does not touch the official install directory or code signature.
- **Never** rewrites API Key / Base URL; relay and theme stay separate.

## License

- See [`macos/LICENSE`](./macos/LICENSE) (MIT) and [`macos/NOTICE.md`](./macos/NOTICE.md)
- Unofficial; Codex and related rights belong to their owners.
- People / IP art in previews is illustrative only — clear rights before commercial redistribution.

---

Star it, pick a look, and make Codex yours for today.
