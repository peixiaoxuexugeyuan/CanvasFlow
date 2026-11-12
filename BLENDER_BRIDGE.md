# Blender 本地建模连接

当前实现为工具模式：CanvasFlow 本地服务调用 Blender，接收结构化建模操作，导出 GLB、PNG 预览和可继续编辑的 `.blend` 源工程。此流程没有接入或调用语言模型 API，也没有部署 AI 权重。

## 使用

打开项目中的 3D 导演台，点击左侧的 **Blender 本地建模**，或预演台右上角的 **Blender 建模**（展开对话工具条也有入口）。

1. 确认显示“已连接 Blender”。可以展开连接设置，配置 `blender.exe` 的绝对路径。
2. 选择新建模型，或选择一个已经完成的源工程版本。
3. 添加操作，或载入明确标注的书桌工具示例；高级面板可查看和编辑 JSON 工具指令。
4. 执行建模。任务完成后模型自动存入当前工作区的素材管理及“我的资产”。
5. 点击“加入场景”。选中由 Blender 创建的模型后，再打开连接面板，可以创建修改版本并“更新选中模型”。更新保留对象 ID、位置、旋转、缩放及动画轨道，可在当前场景撤销、重做。

每次任务都是独立版本，修改前会读取所选 `.blend` 源工程。不会覆盖上一版本的源文件，也不自动覆盖已经放入其他项目中的模型。

## 当前工具

| 操作 | 参数 |
| --- | --- |
| `create` | `id`, `shape`（box/cylinder/sphere/torus/extrude）, `name`, `size`, `position`, `rotation`, `color`；挤出支持二维 `outline` |
| `update` | 已存在的 `id`，及需要修改的 `name/size/position/rotation` |
| `bevel` | `id`, `width`（米）, `segments` |
| `subdivide` | `id`, `levels`（0–3） |
| `material` | `id`, `color`（#RRGGBB）, `roughness`, `metallic` |
| `boolean` | 目标 `id`, 切割体 `toolId`, `operation`（DIFFERENCE/UNION/INTERSECT）, `keepTool` |
| `smooth` / `remove` | `id` |

单位为米，坐标 Y 向上，位置为部件中心，尺寸为部件自身坐标下的宽、高、深。服务自动转换 Blender 的 Z 向上坐标，再导出为 glTF 的 Y 向上坐标。模型修改使用稳定的部件 ID；可在任务结果中读取部件列表。

只执行已经封装的工具，不接受任意 Python、系统命令、文件路径或外部资产 URL。每个任务最多 160 个操作，单模型最多 600 个部件，输出超过 150 万三角面或 40 MB 会失败。任务串行执行，最多四个等待/执行任务，单任务超时四分钟。

## 接口

接口复用现有工作区请求头 `X-Workspace-Id`，以及应用的同源写入检查。

- `GET /api/blender/status`：检测 Blender、版本及工具集合。
- `PUT /api/blender/settings`：`{"executable":"D:\\...\\blender.exe"}`，空字符串恢复自动检测。
- `GET /api/blender/examples`：两个明确标注的工具示例。
- `POST /api/blender/jobs`：`{"name":"模型名","sourceJobId":"可选源版本 ID","operations":[...]}`，返回 202 和任务 ID。
- `GET /api/blender/jobs`、`GET /api/blender/jobs/{id}`：当前工作区的版本、状态、错误、部件统计和素材记录。
- `GET /api/blender/jobs/{id}/download?format=blend|glb&workspace={工作区ID}`：下载源工程或模型。

后续语言模型接入可以复用同一份工具协议、提交任务并轮询结果。本次没有启用自然语言到这些工具的自动调用。

## 文件与安装

- Blender 自动检测顺序：`CANVASFLOW_BLENDER`、连接设置、PATH、应用及其父目录中的 `.runtime/blender/blender-*/blender.exe`、系统标准安装目录。
- 源码仓库不附带 Blender 运行程序。请从 https://www.blender.org/download/ 下载并安装 Blender，或将官方 Windows 便携版解压到 `.runtime/blender/<版本目录>/`，然后在连接设置中选择实际的 `blender.exe`。开发时曾使用 Blender 4.5.9 LTS；下载时应核对该版本的官方校验值，并保留运行目录内的许可和版权文件。
- 任务位于 `server-data/blender/blend-{ID}/`，包括工具指令、结果、日志、源工程、GLB 和预览。
- GLB 和预览另存入现有媒体服务，素材记录包含 `blenderJobId`。保留的任务版本也计入媒体引用检查。
- 本地发布包的 Blender 放在同样的 `.runtime/blender/` 位置；迁移时应保留整个 `server-data/`，否则只能导入 GLB，不能继续编辑丢失的源工程。

## 验收

```powershell
python -m unittest discover -s tests -p test_blender_bridge.py
node tests/test_director_defaults.cjs
```

真实 Blender 测试使用临时目录，覆盖书桌创建、布尔开孔、倒角、材质、源版本修改、GLB 校验、挤出、细分、错误反馈和工作区隔离。没有 Blender 时真实执行测试会标记跳过。

开发阶段曾使用“双抽屉书桌”示例验收本地建模工具链。历史验收项目、模型和报告不随源码发布；取得源码后可通过上述测试及应用内书桌示例重新验证。复杂人物、精细雕刻、UV 编辑等尚未作为可调用工具实现。
