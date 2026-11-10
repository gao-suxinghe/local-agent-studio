# 本机工作室 · Local Agent Studio

本机工作室是个人多 Agent 项目协作客户端。把你电脑上的 Codex、Hermes Agent 和 DeepSeek Harness 接入一个工作室，为项目安排负责人、执行者和复核者，在看板和数字办公室里查看进展。

- 在草稿箱整理想法，准备好后把它们变成项目任务。
- 在看板拖动任务来安排执行、请求停止或进入验收。
- 按前置依赖、优先级和验收要求组织工作，由不同成员执行和复核。
- 任务记录和成果保存在本机。引擎执行所需的登录和网络由各引擎配置决定。

## 安装与使用

在仓库的 Releases 选择对应系统的安装包。Windows x64 完整解压后运行「安装Windows客户端.cmd」。Mac M 系列芯片选 arm64，Intel 芯片选 x64。Mac 安装包为预览版，真机验证、Developer ID 签名和公证待完成。

安装后打开「本机工作室」，在「接入中心」连接已安装并登录的引擎。创建项目后选择本机项目目录，为成员分配角色，再建立任务。自动派发默认关闭，可先手动执行一项任务。详细操作见[使用与接入说明](docs/使用与接入说明.txt)。

## 开发

需要 Node.js 24 或更高版本。打包 ZIP 另需 Python 3.10 或更高版本。

```sh
npm ci
npm test
npm run dev -- --data-dir ./work/dev-data --profile-dir ./work/dev-profile
```

最后一条命令以单独的数据目录打开桌面界面，方便验证改动。测试使用临时数据库和模拟引擎。

在 Windows x64 上执行以下命令生成安装包。

```powershell
npm run build:win
python tools/package-release.py windows
```

在 macOS 上执行以下命令生成 Apple Silicon 和 Intel 预览包。

```sh
node tools/build.mjs darwin arm64
node tools/build.mjs darwin x64
python3 tools/package-release.py mac dist release/mac
```

首次打包会从官方发布下载对应的 Electron 运行时。构建文件默认放在 `dist/`，安装 ZIP 放在 `release/`。

## 许可

工作室源码按 [MIT](LICENSE) 授权。场景的历史来源、随包运行时及构建依赖的许可见[项目来源与第三方许可](THIRD_PARTY_NOTICES.md)。
