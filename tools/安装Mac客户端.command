#!/bin/sh
set -eu
studio_folder=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
studio_source="$studio_folder/本机工作室.app"
studio_marker="$studio_source/Contents/Resources/studio-build.json"
if [ ! -f "$studio_marker" ] || ! /usr/bin/grep -q '"id":"local.agentoffice.studio"' "$studio_marker"; then
  printf '%s\n' '请完整解压本机工作室安装包。'; exit 1
fi
studio_arch=x64
if [ "$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null || printf '0')" = 1 ]; then studio_arch=arm64; fi
if ! /usr/bin/grep -q "\"arch\":\"$studio_arch\"" "$studio_marker"; then printf '%s\n' '安装包与当前 Mac 芯片不匹配。'; exit 1; fi
studio_target="$HOME/Applications/本机工作室.app"
if [ -e "$studio_target" ]; then
  if [ ! -f "$studio_target/Contents/Resources/studio-build.json" ] || ! /usr/bin/grep -q '"id":"local.agentoffice.studio"' "$studio_target/Contents/Resources/studio-build.json"; then printf '%s\n' '目标位置已有其他应用，已保留。'; exit 1; fi
  if /usr/bin/pgrep -f "$studio_target/Contents/MacOS/AgentOfficeStudio" >/dev/null; then printf '%s\n' '请在设置中结束本机后台并关闭客户端，再安装更新。'; exit 1; fi
  studio_backup="$HOME/Library/Application Support/AgentOfficeStudio/backups/$(/bin/date +%Y%m%d-%H%M%S)"
  /bin/mkdir -p "$studio_backup"
  /usr/bin/ditto "$studio_target" "$studio_backup/本机工作室.app"
fi
/bin/mkdir -p "$HOME/Applications"
/usr/bin/ditto "$studio_source" "$studio_target"
/usr/bin/codesign --force --deep --sign - --preserve-metadata=entitlements,flags "$studio_target"
studio_link="$HOME/Desktop/本机工作室.app"
if [ ! -e "$studio_link" ] && [ ! -L "$studio_link" ]; then /bin/ln -s "$studio_target" "$studio_link"; fi
printf '%s\n' '安装完成。打开 ~/Applications/本机工作室.app 或桌面入口。'
