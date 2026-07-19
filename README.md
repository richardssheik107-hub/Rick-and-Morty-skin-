# Codex Dream Skin

> 当前仓库提供 Windows `rick-portal` 主题 `1.6.0-preview.10`：完整深空工作背景、分层人物前景、自然流动的绿色传送门、深青黑原生控件皮肤，以及可恢复的 CDP 注入启动流程。

<p align="center">
  <strong>中文</strong> · <a href="./README.en.md">English</a>
</p>

<p align="center">
  <strong>给 Codex 桌面端换一张会呼吸的脸。</strong><br>
  外部主题 / 换肤工具 · 本机 CDP 注入 · 不改官方安装包
</p>

<p align="center">
  一张图，一种心情 · 写代码，也要有氛围感
</p>

<p align="center">
  非 OpenAI 官方产品。不修改 <code>.app</code> / <code>app.asar</code> / WindowsApps。
</p>

## 赞助商

<p align="center">
  <a href="https://passion8.cc/register?aff=TuPe">
    <img src="docs/images/sponsor-passion8.png" alt="Passion8" height="72">
  </a>
</p>

<p align="center">
  <strong>更智能的连接 · 更热爱的创造</strong><br>
  <sub>热爱驱动 · 无限可能 · Connect AI · Power Creation</sub>
</p>

<p align="center">
  感谢 <a href="https://passion8.cc/register?aff=TuPe"><strong>passion8.cc</strong></a> 赞助本项目。<br>
  满血 AI 中转：官方模型直连，无降智、无套壳；一行配置接入 Codex / Claude Code / Grok。
</p>

<p align="center">
  <sub>
    换肤与 API 配置互相独立，本项目不会自动改写你的模型供应商设置。
  </sub>
</p>

## 效果预览

一张图，一种心情。下面都是可落地的主题示意效果：

<p align="center">
  <img src="docs/images/gallery/skin-01.jpg" alt="粉系定制" width="900"><br>
  <sub>粉系定制</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-02.jpg" alt="财神打工" width="900"><br>
  <sub>财神打工版</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-03.jpg" alt="红白科幻" width="900"><br>
  <sub>红白科幻</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-04.jpg" alt="清透定制" width="900"><br>
  <sub>清透定制</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-05.jpg" alt="灵感小宇宙" width="900"><br>
  <sub>灵感小宇宙</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-06.jpg" alt="紫夜限定" width="900"><br>
  <sub>紫夜限定</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-07.jpg" alt="初音未来" width="900"><br>
  <sub>初音未来</sub>
</p>

<p align="center">
  <img src="docs/images/gallery/skin-08.jpg" alt="舞台黑金" width="900"><br>
  <sub>舞台黑金</sub>
</p>

## 它能做什么

- **真·可交互**：侧栏、建议卡、项目选择、输入框都是原生控件，不是整窗假截图贴上去
- **可换图**：换一张喜欢的图，就能变成你的主题
- **可恢复**：一键还原官方外观
- **相对安全**：本机回环 CDP 注入，不改官方二进制与签名

## 快速开始

仓库内按平台放了现成脚本（实现细节不同，效果都是「主题化 Codex」）：

| 平台 | 目录 | 入口 |
|------|------|------|
| Apple Silicon / Intel Mac | [`macos/`](./macos/) | 双击 `Install Codex Dream Skin.command` |
| Windows | [`windows/`](./windows/) | `scripts/install-dream-skin.ps1` → `start-dream-skin.ps1` |

更细的说明：

- Mac：[`macos/README.md`](./macos/README.md)
- Windows：[`windows/SKILL.md`](./windows/SKILL.md)
- 路径对照：[`docs/platforms.md`](./docs/platforms.md)
- 项目记录：[`docs/PROJECT.md`](./docs/PROJECT.md)

### Windows 直接克隆部署

运行条件：

- Windows 10/11，已从 Microsoft Store 安装并登录 Codex
- PowerShell 5.1 或更高版本
- Node.js 18 或更高版本（运行 `node --version` 检查）
- Git（只用于克隆和后续更新）

在当前预览版合入 `main` 前，请直接克隆主题分支：

```powershell
git clone --branch agent/animated-portal-v1.6.0-preview --single-branch https://github.com/richardssheik107-hub/Rick-and-Morty-skin-.git
Set-Location .\Rick-and-Morty-skin-
```

安装快捷方式、Guardian 和默认主题，然后启动：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\scripts\install-dream-skin.ps1 -Port 9347 -Theme rick-portal
.\windows\bin\CodexDreamSkinLauncher.exe -Port 9347 -Theme rick-portal
```

安装程序会创建桌面和开始菜单的 `Codex Dream Skin` 快捷方式、登录启动项以及 `%LOCALAPPDATA%\CodexDreamSkin\profile` 持久主题资料目录。它不会修改 `WindowsApps`、官方程序文件、账号登录信息或已有任务。

验证主题和动画是否完整：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\scripts\verify-dream-skin.ps1 -Port 9347 -Theme rick-portal
```

输出中的 `"pass": true` 表示侧栏、输入框、背景、人物前景、传送门动画和图层关系全部通过检查。

### 正确固定到任务栏

1. 先取消固定官方 `Codex` / `ChatGPT` 图标。
2. 在开始菜单搜索 **Codex Dream Skin**。
3. 直接右键这个搜索结果并选择“固定到任务栏”。
4. 不要从正在运行的 Codex 窗口再次执行“固定到任务栏”；Windows 会固定官方应用 AUMID，从而绕过主题启动器。

固定项的正确目标应是：

```text
windows\bin\CodexDreamSkinLauncher.exe -Port 9347 -Theme "rick-portal"
```

### 更新现有安装

```powershell
git pull
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\scripts\install-dream-skin.ps1 -Port 9347 -Theme rick-portal
```

Codex Store 应用更新后也建议重新运行一次安装命令，用于刷新快捷方式图标。启动器每次都会动态查找最新的 Store 包，不依赖旧版 `WindowsApps` 路径。

## 常见问题与修复记录

### 1. 从任务栏打开后仍是官方界面

先检查任务栏固定的是否为 `Codex Dream Skin`，然后读取启动日志：

```powershell
Get-Content "$env:LOCALAPPDATA\CodexDreamSkin\launcher.log" -Tail 40
```

如果日志没有新增记录，点击的仍是官方入口；按“正确固定到任务栏”重新固定。如果日志有记录但主题未出现，执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\scripts\start-dream-skin.ps1 -Port 9347 -Theme rick-portal -WaitForNetwork -RestartExisting
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\scripts\verify-dream-skin.ps1 -Port 9347 -Theme rick-portal
```

### 2. Codex 更新后提示端口未启动

我们遇到过新版 Codex 只监听 IPv6 回环 `::1:9347`、旧版残留进程暂时占用 IPv4 `127.0.0.1:9347` 的情况。旧脚本只检查 IPv4，因此会误判并重复等待。当前版本的启动器、Guardian 和注入器会同时检查 IPv6 与 IPv4，无需手动改端口。

诊断命令：

```powershell
Get-NetTCPConnection -State Listen -LocalPort 9347
Invoke-RestMethod http://localhost:9347/json/version
```

### 3. VPN/Clash 已连接，但仍显示重新连接

Windows 用户代理与 WinHTTP 代理可能不是同一条链路。项目现在会读取当前用户的 Windows Internet Proxy，等待代理端口可用，使用同一路由探测 OpenAI，并把代理传给 Chromium 和 Codex 辅助进程；不会写入永久的机器级代理。

检查 Clash 常见端口 `7890`：

```powershell
Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' | Select-Object ProxyEnable,ProxyServer
Test-NetConnection 127.0.0.1 -Port 7890
```

确保 Clash/VPN 已开启“系统代理”，并且 `ProxyEnable` 为 `1`、代理端口可以连接。启动日志中应出现 `Using configured Windows proxy ...`。

### 4. Codex 被反复关闭和重新打开

Guardian 负责监测从官方入口启动的无主题窗口，再调用主题启动器转换一次。早期版本在调试端口误判时可能重复转换；当前版本会等待启动互斥锁、识别 IPv4/IPv6，并在同一可见进程转换失败后退出，避免循环重启。

相关状态和日志：

```text
%LOCALAPPDATA%\CodexDreamSkin\guardian-state.json
%LOCALAPPDATA%\CodexDreamSkin\guardian.log
%LOCALAPPDATA%\CodexDreamSkin\launcher.log
%LOCALAPPDATA%\CodexDreamSkin\injector.log
%LOCALAPPDATA%\CodexDreamSkin\injector-error.log
```

### 5. 主题在新聊天、页面跳转或刷新后消失

保持 Guardian 和 Node 注入器运行。当前注入器会监听页面加载和路由变化并自动重新注入。可以重新运行 `Codex Dream Skin` 快捷方式安全修复；如果 Guardian 状态已过期，启动器会自动创建新的 Guardian。

### 6. 恢复官方界面或卸载快捷方式

仅移除当前主题：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\scripts\restore-dream-skin.ps1 -Port 9347
```

同时移除快捷方式并恢复安装前的基础配色：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\scripts\restore-dream-skin.ps1 -Port 9347 -Uninstall -RestoreBaseTheme
```

## 反馈与贡献

- **Issue：** 请用 [Issue 模板](./.github/ISSUE_TEMPLATE/)（Bug / 功能）；已关闭空白 Issue。提交前建议先跑 Verify / Restore 自检。
- **PR：** 请按 [PR 模板](./.github/pull_request_template.md) 写清改动，并勾选对应自测（如 `macos/tests/run-tests.sh`、verify / restore）。

## 安全边界

- CDP 只绑定本机 IPv4/IPv6 回环地址，主题运行期间勿运行来路不明的本机程序
- 不修改官方安装目录与代码签名
- **不会**自动改写 API Key / Base URL；中转与换肤分开

## 许可与声明

- 见 [`macos/LICENSE`](./macos/LICENSE)（MIT）与 [`macos/NOTICE.md`](./macos/NOTICE.md)
- 非 OpenAI 官方产品；Codex 及相关权利归其权利人
- 效果图中的人物 / IP 形象仅作主题示意；商用或公开再分发请自行确认肖像权与商标授权

---

Star 一下，然后挑一张图，把你的 Codex 变成今天想要的样子。
