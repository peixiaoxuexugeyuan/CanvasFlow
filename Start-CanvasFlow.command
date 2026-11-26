#!/bin/bash
# macOS / Linux 源码启动：双击本文件（macOS），或在终端里运行 ./Start-CanvasFlow.command
# 需要 Python 3.10 或更新版本；后端只用标准库，不需要 pip 安装任何东西。
cd "$(dirname "$0")" || exit 1

if [ -d "CanvasFlow.app" ]; then
  open "CanvasFlow.app"
  exit 0
fi

pick_python() {
  for candidate in ".runtime/python-mac/bin/python3" ".venv/bin/python" \
    python3.13 python3.12 python3.11 python3.10 python3 \
    /opt/homebrew/bin/python3 /usr/local/bin/python3; do
    bin="$(command -v "$candidate" 2>/dev/null)" || continue
    if "$bin" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
      echo "$bin"
      return 0
    fi
  done
  return 1
}

PYTHON="$(pick_python)"
if [ -z "$PYTHON" ]; then
  echo "没有找到 Python 3.10 或更新版本。"
  echo "安装办法：到 https://www.python.org/downloads/macos/ 下载安装，或者运行 brew install python@3.12"
  read -r -p "按回车键关闭…" _
  exit 1
fi

"$PYTHON" launch_local.py "$@"
status=$?
if [ $status -ne 0 ]; then
  echo "CanvasFlow 没能启动（退出码 $status）。日志在数据目录的 local-logs/server.log。"
  read -r -p "按回车键关闭…" _
fi
exit $status
