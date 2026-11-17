# LibTV图片与视频生成流程

## 1. 工具与画布边界

优先使用LibTV内置智能体提供的模型检索、schema读取、节点创建、连线、运行和结果展示能力。只有当前环境提供官方 `libtv` CLI 时才使用CLI等价命令；不得自行构造HTTP请求，不得调用LibTV之外的生图或视频服务。

生成前确认当前LibTV画布可用。没有活动画布时停止，请用户打开或绑定目标画布；不得擅自创建新项目或画布。

节点命名使用当前PV暂定标题加用途：`<标题>-核心角色图`、`<标题>-视频-01`。名称冲突时递增末尾编号，不覆盖或删除既有节点。

## 2. 结构化选择组件

所有有限选择和确认都调用LibTV内置智能体的按钮、单选卡、下拉框或可搜索单选列表；CLI只负责在用户点击确认后执行，不负责用终端文字代替交互组件。不得要求用户键入序号、模型名、比例、分辨率或确认语句。

- 模型、比例、画质、分辨率和声音：选项值逐项来自当前schema；推荐项排首位。
- 固定字段：弹出“使用固定值”和“返回更换模型”。
- 执行确认：弹出“确认执行”“返回修改”“停止”。
- 失败恢复：弹出“重试”“修改参数”“停止”。
- 首轮创作：故事、角色、时长、色调、节奏、钩子和声音也先用选项；每题给2—3个具体互斥方案，推荐项在前，点击“自定义”后才展开文本输入。

当前运行环境没有结构化选择组件时停止，不得以自由文本确认替代。

## 3. 运行时模型发现

每次生成都重新读取当前模型和schema，不把参数枚举或价格写入Skill。模型偏好只用于运行时排序：图片优先 `Lib Image`，视频优先 `Minimax H3`；偏好不得越过模式、数量、时长和schema兼容性门禁。

CLI等价操作：

```text
libtv model search --type image
libtv model search --type video
libtv model <modelKey或modelName>
```

选择模型时向用户显示 `modelName`，内部保留唯一 `modelKey`。CLI写节点参数时，`model` 必须传 `modelName`，不能传 `modelKey`。

从schema读取：

- `properties.modeType.items`：支持的文生、单图、图片参考或混合参考模式及入边数量。
- `properties.duration`：枚举或最小值、最大值、步长、默认值。
- `properties.ratio`：画幅比例枚举与默认值。
- `properties.quality` 或 `properties.resolution`：图片／视频分辨率与清晰度。
- `properties.enableSound`：是否支持声音及真实枚举。
- `properties.count`：允许的生成数量。图片字段存在时必须包含1，否则该图片模型不兼容；视频字段存在时必须由用户点击选择，不得沿用默认数量。
- `config.settings`、`config.advancedSettings` 和 `rules`：字段归位与生成前置条件。

schema没有某字段时，显示模型固定默认值或“不支持”，不得虚构参数。模型名称按 `modelName` 忽略大小写精确匹配，不用模糊命中替代型号。

## 4. 图片节点

模型列表中存在且schema兼容时默认选中 `Lib Image`；用户可在图片检查点改选。必须先展示并确认所选模型schema中的图片尺寸（ratio）、画质（quality）和分辨率／清晰度（resolution）；缺失字段按固定值处理，不伪造选项。

执行图片节点前维护以下单向状态机：

`PROMPT_READY → PARAMS_SELECTED → AWAITING_IMAGE_CONFIRM → IMAGE_AUTHORIZED → IMAGE_NODE_CREATED`

- `PROMPT_READY`：只交付提示词，不创建节点。
- `PARAMS_SELECTED`：模型、ratio、quality、resolution均取得当前弹窗点击结果；schema固定值也有确认记录。
- `AWAITING_IMAGE_CONFIRM`：显示完整参数汇总与“确认生成图片／返回修改／停止”，随后停止当前轮。
- `IMAGE_AUTHORIZED`：仅由当前检查点“确认生成图片”的独立点击事件进入；任何历史同意、默认值或其他阶段授权均无效。
- `IMAGE_NODE_CREATED`：只允许从 `IMAGE_AUTHORIZED` 进入；若状态不匹配，拒绝节点工具调用。

授权后创建一个 `image` 节点，写入角色／主体图提示词、模型、比例和分辨率／清晰度，随后运行。schema存在 `count` 时写入 `count=1`；不存在时不得传入未知字段，并验证任务只返回一张图。

CLI骨架：

```text
libtv node create "<标题>-核心角色图" -t image --prompt "<角色图提示词>" \
  -s "model=<modelName>" -s ratio=<ratio> -s <quality或resolution>=<value> -s count=1 --run
```

CLI骨架中的 `count=1` 仅在schema声明该字段时使用。只传schema实际存在的字段。成功时记录节点名、节点ID、任务状态和图片结果；失败时保留节点，输出原始错误摘要并等待重试、改参数或停止。

## 5. 视频模型筛选

先确定是否使用已生成图片，再筛选候选：

- 不使用参考图：模型必须声明 `text2video`。
- 使用参考图：按 `singleImage2video → image2video → mixed2video` 选择第一个受支持模式，并确认允许1张图片入边。
- 模型的 `duration` 必须支持每一个原分段时长。枚举必须逐项包含；范围必须满足min、max和step。
- 使用参考图时，模型规则必须允许prompt与image同时存在。
- 完成上述兼容性筛选后，把 `modelName` 精确匹配 `Minimax H3` 的候选排在首位并默认选中；如果它被筛除，展示具体冲突，不得用名称相近的其他型号替代。

没有兼容模型时不得生成。向用户说明冲突原因，并请求选择：改为文生视频、选择其他模型或允许按模型最大时长重新拆段。

## 6. 视频参数与画幅改写

选择模型后，只展示当前模式schema真实提供的参数，并为每个字段分别调用结构化选择组件。可配置字段不得静默沿用默认值；字段只有一个值时标明“固定”并要求点击确认；没有该字段时显示模型固定行为或“不支持”。声音参数映射：已确认需要音乐、鼓点或音效时可把“开启”排在首位，但仍必须由用户点击；用户选择静默或模型不支持声音时明确标注。

按模型建立强制字段清单：

| 模型匹配 | 必须逐项点击确认 | 界面识别线索；不得替代当前schema |
|---|---|---|
| 名称精确匹配 `Minimax H3`，忽略大小写 | `ratio`、`quality`／`resolution`、`duration`、`count` | 自适应／21:9／16:9／4:3／1:1／3:4／9:16；768P／2K；时长滑杆；1／2／4个 |
| 名称包含 `Seedance`，忽略大小写 | `ratio`、`quality`／`resolution`、`duration`、`enableSound`、`count` | Auto／16:9／4:3／1:1／3:4／9:16／21:9；480P／720P／1080P／4K；时长滑杆；音频开启／关闭；1／2／4个 |
| 其他视频模型 | schema声明的全部影响结果或费用的生成字段 | 只使用当前schema枚举、范围、步长和固定值 |

若模型的当前schema与识别线索不一致，以schema为准并向用户展示真实选项；不得因为表中列出某值便伪造参数。点击后同时保存“界面展示文案”和“schema原始值”，节点只写原始值，例如Seedance界面显示 `4K` 时实际写 `4k`。提示词分段时长只用于兼容性筛选，不构成用户对视频时长字段的选择。生成数量影响节点任务数量或费用，必须显式点击确认。

执行视频节点前维护单向状态机：

`VIDEO_MODEL_SELECTED → VIDEO_PARAMS_SELECTED → AWAITING_VIDEO_CONFIRM → VIDEO_AUTHORIZED → VIDEO_NODE_CREATED → VIDEO_PARAMS_VERIFIED → FIRST_VIDEO_NODE_RUNNING`

- `VIDEO_MODEL_SELECTED`：只完成模型点击，不得创建节点。
- `VIDEO_PARAMS_SELECTED`：当前模型强制字段均取得本轮点击记录；任何默认值或历史选择均无效。
- `AWAITING_VIDEO_CONFIRM`：展示模型、模式、参考图、比例、清晰度、时长、音频、数量和各段时长，弹出“确认生成首段／返回修改／停止”，随后停止当前轮。
- `VIDEO_AUTHORIZED`：只由当前检查点“确认生成首段”的独立点击事件进入。
- `VIDEO_NODE_CREATED`：只允许从 `VIDEO_AUTHORIZED` 进入；创建时不得带 `--run`。
- `VIDEO_PARAMS_VERIFIED`：回读节点，按schema的 `config.settings`、`config.advancedSettings`、`originalField` 和顶层参数逐项精确比对实际落库值。
- `FIRST_VIDEO_NODE_RUNNING`：只允许从 `VIDEO_PARAMS_VERIFIED` 进入；状态不匹配时拒绝运行。

后选视频比例优先。比例变化时，逐段改写：

- 导演总述中的画幅规格。
- 主体在画面中的占比、留白方向和视觉中心。
- 漫画分区、色块切割、UI和文字的排列方向。
- 横移、纵移、平面推拉和遮罩揭示的路径。

不得改变故事事件、角色外观与锚点、主色语义、声音设计、分段时长、镜头时间码和段间桥接。

## 7. 视频节点与参考图连线

视频参数确认后只创建第一段节点，完成参数回读校验后再运行。无参考图时不连图片入边；使用参考图时把已成功图片节点连到视频节点，并在提示词中要求保持角色轮廓、服装色块、道具和面部锚点一致。

文生视频CLI骨架：

```text
libtv node create "<标题>-视频-01" -t video --prompt "<第1段提示词>" \
  -s "model=<modelName>" -s modeType=text2video -s duration=<秒> \
  -s ratio=<ratio原始值> -s resolution=<resolution原始值> -s count=<count原始值>
```

参考图CLI骨架：

```text
libtv node create "<标题>-视频-01" -t video --prompt "<第1段提示词>" \
  --left "<标题>-核心角色图" -s "model=<modelName>" \
  -s modeType=<受支持参考模式> -s duration=<秒> \
  -s ratio=<ratio原始值> -s resolution=<resolution原始值> -s count=<count原始值>
```

`enableSound` 仅在schema存在时传入。`quality` 与 `resolution` 必须使用当前schema真实属性名或其 `originalField`，不得凭界面“清晰度”文案猜键名。所有字段必须通过当前模型schema和rules校验后才运行。

创建后立即查询节点但不运行：

```text
libtv node "<标题>-视频-01"
```

把用户选择的schema原始值解析成期望落库路径：列于当前模式 `config.settings` 的字段比对 `data.params.settings.<originalField或key>`；列于 `config.advancedSettings` 的字段比对 `data.params.advancedSettings.<originalField或key>`；`count`、`modeType` 等生成器顶层字段比对 `data.params.<key>`。模型也必须与已选模型一致。

任一值缺失或不一致时，用对应原始字段和值更新节点，再查询一次。例如H3选择768P时：

```text
libtv node "<标题>-视频-01" -s resolution=768P
libtv node "<标题>-视频-01"
```

只有第二次查询明确返回 `data.params.settings.resolution="768P"` 才能运行；若仍为默认 `2K` 或字段缺失，停止并展示“期望值／实际值”，不得提交生成。全部字段一致后才执行：

```text
libtv node "<标题>-视频-01" --run
```

## 8. 首段试跑与余段

首段成功后展示结果，等待用户选择继续、调整或停止。继续时为余段逐一创建独立节点，沿用已确认模型、模式、比例、分辨率、声音和参考图选择，只替换段提示词、时长和序号。

可提交全部余段，但每段任务独立记录。某段失败时：

1. 不重跑任何成功节点。
2. 使用原参数自动重试该失败节点一次。
3. 第二次失败则停止该节点，报告节点ID、段号和错误摘要；其他成功片段继续保留。

用户调整首段时只更新首段节点或建立新的重试节点，不改变已生成角色／主体图。用户停止时不删除任何节点或结果。
