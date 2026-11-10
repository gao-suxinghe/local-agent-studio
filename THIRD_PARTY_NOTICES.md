# 项目来源与第三方许可

本机工作室由苏星河发布。工作室源码及项目自有素材按 [MIT 许可证](LICENSE) 授权。

## 项目沿革

本机工作室在早期的本机 Codex Task Board 和「办公室」项目之后开发。当前的项目、成员、任务调度和引擎适配由本机工作室实现。三分区办公场景、人物与动画、部分界面样式及应用图标沿用并适配了「办公室 0.8.0」的实现。这部分主要位于 `backend/assets/` 和 `app/icons/`。

## 运行时与构建依赖

| 组件 | 用途和许可 |
| --- | --- |
| Electron 45.2.3 | 桌面窗口及运行时，使用 [Electron MIT 许可证](https://github.com/electron/electron/blob/v45.2.3/LICENSE)。随安装包保留 Electron 的 `LICENSE` 和 `LICENSES.chromium.html`。 |
| Chromium、Node.js、SQLite、FFmpeg 等 | 来自 [Electron 45.2.3 的上游构建](https://github.com/electron/electron/releases/tag/v45.2.3)，各自按随包声明中的许可使用。源码版本与构建依赖见 [Electron 源码和 DEPS](https://github.com/electron/electron/blob/v45.2.3/DEPS)。 |
| @electron/packager 20.3.0 | 构建工具，使用 [BSD 2-Clause 许可证](https://github.com/electron/packager/blob/v20.3.0/LICENSE)。其他构建依赖及版本见 [package-lock.json](package-lock.json)。 |

Electron 安装包内含 FFmpeg 动态库。随包声明列有 FFmpeg 的 GNU LGPL 2.1 或更高版本及相关文件的许可。Electron 45.2.3 采用 [Chromium 156.0.8078.80](https://github.com/chromium/chromium/blob/156.0.8078.80/DEPS)，其 [FFmpeg 源码提交](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/9db86ce5b5b454dfc96c435f9f0723012980c37f) 为 `9db86ce5b5b454dfc96c435f9f0723012980c37f`。Electron 的 [补丁配置](https://github.com/electron/electron/blob/v45.2.3/patches/config.json) 记录了 FFmpeg 补丁的应用位置。发布预编译安装包时，在同一 Release 提供对应的库源码和构建说明。

## 引擎接入

工作室通过 [Codex App Server](https://learn.chatgpt.com/docs/app-server) 和 ACP 连接本机的 [Hermes Agent](https://github.com/NousResearch/hermes-agent) 与 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。这些引擎由使用者按各自的渠道安装，适用各自的许可及使用条款。
