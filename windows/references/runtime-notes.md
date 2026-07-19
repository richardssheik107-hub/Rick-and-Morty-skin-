# Runtime notes

- The skin launches the Store-installed `ChatGPT.exe` with `--remote-debugging-port=<port>` and injects through CDP. Chromium 136+ requires a non-default `--user-data-dir`; Windows therefore keeps a persistent skin profile under `%LOCALAPPDATA%\CodexDreamSkin\profile`.
- Store package executables under `WindowsApps` may reject direct `Start-Process`. The launcher uses Windows `IApplicationActivationManager` with the package AUMID so the supported full-trust activation path receives the CDP arguments.
- The default production port is `9335`; test instances may use another port plus an isolated `--user-data-dir`.
- CDP is bound to loopback. Do not expose it on a LAN interface.
- CDP discovery probes both IPv6 (`::1`) and IPv4 (`127.0.0.1`) loopback. Recent Store builds can bind only IPv6 when an older process temporarily owns the IPv4 port, so launch, guardian, and injector checks must not assume IPv4.
- The injector polls page targets and reinjects after document loads. In-page route changes use a debounced observer plus a low-frequency safety check to avoid CPU churn during streamed tasks.
- `%LOCALAPPDATA%\CodexDreamSkin\state.json` records the port and daemon PID. Logs stay in the same directory.
- A normally launched Codex window may remain open while the persistent skin profile starts. Once the themed window is verified, close the unthemed window if it is no longer needed.
- Store updates are supported because the launcher queries `Get-AppxPackage OpenAI.Codex` on every launch.
- When the current user's Windows Internet proxy is enabled, the launcher validates its endpoint, probes OpenAI through that same route, passes it to Chromium with `--proxy-server`, and exposes process-local `HTTP_PROXY`, `HTTPS_PROXY`, and `ALL_PROXY` values for Codex helpers. Nothing is written to the machine-wide proxy configuration, so stopping the VPN does not leave a stale global override.
