# Windows changelog

## 1.5.5 - 2026-07-16

### 新增

- 新增 `rick-portal` 双场景主题：首页、新聊天和新项目显示人物传送门横幅，正常任务显示宇宙传送门工作背景。
- 新增深青黑侧栏、原生建议卡、项目选择器、输入框、弹窗、代码块和消息区域的统一视觉层。
- 启动与验证脚本新增 `-Theme` 参数；默认使用 `rick-portal`，可通过 `-Theme dream` 切回原主题。
- 安装器默认创建 Windows 登录自启动快捷方式，让 `rick-portal` 成为日常启动版本；可用 `-NoAutoStart` 关闭。

### 改进

- `rick-portal` 安装只备份 Codex 配置，不强制切换官方浅色外观。
- 页面路由变化后自动在首页、任务页和辅助页之间切换背景，保留原生控件和一键恢复能力。
- 首页横幅升级为 1600×420 原创高清传送门插画，移除截图边框、裁切残缺和低清压缩痕迹，并保留左侧原生文案安全区。
- 首页高清横幅中的少年搭档替换为用户指定的橙色护目镜、黄色装备角色，并保持传送门光照一致。
- 新建任务页改为全屏云海科幻插画：老科学家使用浅蓝刺发、白色实验服形象，少年换成协调的黄青探险装，并将人物与飞行器集中在右下方以避让操作区。
- 新建任务页标题调整为“我们应该在〔项目选择器〕维度中做些什么？”，顶部横幅改为不含人物的绿色传送门与机械舱场景。
- 登录自启动与桌面启动现在会等待 VPN/网络可访问 `chatgpt.com:443` 后再打开 Codex，避免启动过早导致反复重连。
- 启动器加入按端口命名的单实例锁，防止 Windows 登录自启动与手动双击同时创建重复主题实例。

### 修复

- 适配 Chromium 136+ 的远程调试安全限制：Windows 启动器默认使用持久化的非默认主题配置目录，修复双击快捷方式后 CDP 端口未启动的问题。
- 改用 Windows `IApplicationActivationManager` 启动 Store 打包应用，修复直接运行 `WindowsApps` 中的 Codex 可执行文件时报“Access is denied”的问题。
- 新增 `launcher.log`，启动失败时保留错误原因，避免快捷方式窗口关闭后无法诊断。
- 修复主题热更新无条件复用旧图片 Blob 的问题；主题版本变化时会释放旧资源并加载新插画。
- 移除建议卡的位移、阴影过渡和子元素动画，降低展示卡顿；统一图标绝对居中并将建议卡组下移约 38px。
- Added a login guardian that redirects launches from the official Store Codex icon into the persistent themed profile.
- The themed shortcuts now reuse the official Codex application icon.
