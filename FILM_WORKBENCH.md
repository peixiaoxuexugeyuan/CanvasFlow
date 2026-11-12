# 成片工作台

从创作画布打开「成片工作台」，导入当前画布的图片、视频或音频。可以在 OpenFilm Studio 时间轴上剪辑，也可以用配置好的 CanvasFlow 助手协助编辑。每张画布关联独立的成片工程。

## 开发运行环境

1. 安装 Node.js 24 和 pnpm。将 Windows 版 Node.js 运行文件放在 `.runtime/node/`，使 `.runtime/node/node.exe` 存在。
2. 在源码根目录执行 `pnpm --dir tools/openfilm install --frozen-lockfile`。锁文件读取仓库内固定版本的 OpenFilm npm 包。
3. 将 Windows FFmpeg 解压到 `.runtime/openfilm-ffmpeg/`，目录结构为 `.runtime/openfilm-ffmpeg/<版本目录>/bin/ffmpeg.exe`。将便携 Git for Windows 放到 `.runtime/openfilm-git/`，使 `.runtime/openfilm-git/cmd/git.exe` 存在。
4. 在源码根目录执行以下命令，安装 OpenFilm 依赖的 Chromium 无头组件：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location).Path '.runtime\openfilm-browser'
pnpm dlx playwright-core@1.61.1 install chromium --only-shell
```

组件版本和来源见 [runtime-sources.json](tools/openfilm/runtime-sources.json)。启动本地服务后打开「成片工作台」。本地编辑和导出可使用导入素材。AI 生成、配音和助手调用需要配置对应模型服务。
