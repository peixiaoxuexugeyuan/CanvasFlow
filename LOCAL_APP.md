# 本地数据与运行

启动方式见 [README](README.md)。默认数据目录是源码根目录的 `server-data/`，包含项目、供应商配置、生成记录和媒体。桌面版默认将数据写入 `%APPDATA%\CanvasFlow\data`。

要为一次开发验证使用独立的数据目录，可以在启动前设置：

```powershell
$env:CANVASFLOW_DATA_DIR = Join-Path $env:TEMP 'canvasflow-local-dev'
python launch_local.py --port 5181 --no-open
```

迁移项目时先退出所有使用原目录的实例，再复制完整数据目录。生成媒体在 `media/`，成片工程在 `films/`。本地服务日志在数据目录的 `local-logs/server.log`。
