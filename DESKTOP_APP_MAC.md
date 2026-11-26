# macOS 桌面应用

macOS 版和 Windows 版用同一套后端和同一个 Electron 壳，只是打包脚本不同。数据默认保存在 `~/Library/Application Support/CanvasFlow/data`。

## 源码启动

双击 `Start-CanvasFlow.command`（或在终端里运行它）。需要 Python 3.10 或更新版本，后端只用标准库。

## 打包

在一台 Mac 上：

```bash
cd tools/desktop && pnpm install --frozen-lockfile
cd ../release && pnpm install --frozen-lockfile
cd ../..
CANVASFLOW_PYTHON_RUNTIME=/path/to/python node tools/desktop/build-mac.cjs
```

`CANVASFLOW_PYTHON_RUNTIME` 指向一份可搬动的 CPython（python-build-standalone 的目录结构，里面有 `bin/python3`），架构要和目标一致。产物在 `dist-v<版本>-mac/`：`CanvasFlow.app` 和一个 zip。

## 已验证

- Apple Silicon（arm64）、macOS 26：启动、后端就绪、页面加载、退出后不留进程，运行后签名校验仍通过。

## 还没有的

- 只做了临时签名（ad-hoc）。第一次打开要在访达里右键 → 打开。要去掉这个提示需要 Developer ID 证书和公证。
- 没有随包 Blender 和成片编辑器（OpenFilm）的运行环境：这两样需要各自的 macOS 版本放进 `.runtime/`，脚本发现有就会带上。
- 没有自动更新（`updater.cjs` 目前只认 Windows x64）。
- Intel（x64）没有实机验证；脚本支持 `--x64`，需要配一份 x64 的 Python。
