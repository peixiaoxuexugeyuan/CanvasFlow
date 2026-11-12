# Windows 发行构建

构建前准备 Node.js 24、pnpm、Python 3.12，以及构建所需的 Windows 工具。使用可分发的 Python 运行时和 Blender，分别放在 `.runtime/python/` 和 `.runtime/blender/`，或设置 `CANVASFLOW_PYTHON_RUNTIME`、`CANVASFLOW_BLENDER_RUNTIME` 指向实际目录。成片所需组件见 [成片工作台](FILM_WORKBENCH.md)。

```powershell
pnpm --dir tools/release install --frozen-lockfile
pnpm --dir tools/desktop install --frozen-lockfile
pnpm --dir tools/openfilm install --frozen-lockfile
python -m venv tools/native/.venv
tools/native/.venv/Scripts/python.exe -m pip install -r tools/native/requirements.txt
```

1. 执行 `tools/native/build.ps1` 生成原生后端。
2. 执行 `node tools/desktop/build.cjs dist-v1.0.0 --protect`。输出目录须为新目录。
3. 执行 `node tools/desktop/package-release.cjs` 生成 NSIS 安装程序和安全删除清单。默认读取 `tools/desktop/app/package.json` 的版本。
4. 在干净的 Windows 环境完成首次启动、安装、升级和卸载验收，再生成发行文件校验值。发行版本应对应实际构建所用的源码提交。

发行附件需要保留实际分发组件的第三方声明和对应材料。公开仓库的源码和本机生成的安装附件各自核对文件清单，排除运行数据、密钥、测试输出和本机配置。

## 应用内更新

安装包构建成功后会同时生成 `latest.json`。先上传并核验安装包，再发布官网更新清单；完整步骤见 [桌面更新说明](DESKTOP_UPDATES.md)。
