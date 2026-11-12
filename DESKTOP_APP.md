# Windows 桌面应用

桌面应用使用 Electron 启动本机 Python 服务，并在应用窗口中打开 CanvasFlow。构建及打包步骤见 [发行构建](RELEASING.md)。

数据默认保存在 `%APPDATA%\CanvasFlow\data`。可以在桌面程序旁创建本地 `desktop-config.json`，用 `dataDirectory` 设置数据目录，用 `backendDirectory` 设置后端路径。示例：

```json
{
  "dataDirectory": "userdata"
}
```

升级前备份实际数据目录。使用 `tools/desktop/package-release.cjs` 生成安装包，以便安装和卸载根据发行文件清单处理程序文件。
