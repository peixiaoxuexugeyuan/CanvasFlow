# 角色板、12 格故事板与视频提示词母版

本文件提取参考截图中的通用方法，不复制其中的具体人物、宗教元素、场景、故事或平台专用风格码。每次使用时必须将方括号变量替换为当前项目内容。

## 共同变量

```text
[PROJECT_THEME]        项目主题
[CHARACTER_REF]        用户人物参考图或已生成角色板
[CHARACTER_BOARD_REF]  已确认的角色身份板
[CHARACTER_LOCK]       脸型、五官、发型、体型、服装、配饰等固定项
[LOCATION]             核心场景
[SCENE_REF]            用户场景参考图（若有）
[SCENE_ENV_TYPE]       built-environment 或 natural-landscape
[SCENE_STYLE_MASTER]   已确认的场景视觉母版；可由 Midjourney 或其它图片节点生成
[REFERENCE_VISUAL_FACTS] 从用户参考图提取的可观察事实，不写抽象套话
[GLOBAL_STYLE_SUFFIX]   跨人物、地点与镜头保持一致的电影质感后缀
[LIGHTING_SUFFIX]       当前镜头唯一的光线/时段模块
[MJ_PARAMETER_SUFFIX]   仅 Midjourney 使用的参数，默认 --ar 16:9 --raw
[SCENE_ANCHOR_REF]     当前片段使用的已确认场景锚点
[SCENE_LOCK]           空间拓扑、固定陈设、材质、光向、时间、天气等固定项
[SEGMENT_STORYBOARD_REF] 当前片段专用的3格或4格分镜参考
[PREVIOUS_END_FRAME]   上一片段实际尾帧或等效连续性关键帧
[ACTION_LANGUAGE]      主体动作体系
[EMOTION_ARC]          情绪起点、发展、高潮、结尾
[FINAL_POSE]           最终标志性姿态
[MUSIC_REF]            音频或音乐结构
[EXPRESSION_MODE]      emotional-poetic 或 performance-dynamic
```

## 表达模式

先选择一种模式，并让角色板、故事板、视频提示词和声音设计全部继承同一模式。

### emotional-poetic｜情绪文艺

- 通过微表情、呼吸、凝视、停顿、缓慢行走、触摸物件、头发/衣料轻动，以及光线、天气、空间、色彩和环境声的变化推进情绪。
- 允许固定机位、缓慢推进/拉远、克制手持、长焦观察、遮挡构图、反射、空镜、长镜头感和极端负空间。
- 高潮是“视听峰值”，不等于哭喊、奔跑、跌倒、舞蹈或夸张表演。
- 剪辑可使用动作匹配、视线匹配、声音桥、构图呼应和有动机的轻微叠化；避免无意义快切。

### performance-dynamic｜动态表演

- 通过清楚身体动力线、舞蹈/行为动作、快速机位变化和节拍落点推进。
- 允许手持能量、快速平移、环绕、顶视、低机位、侵入式近景与动作匹配硬切。
- 高潮可以是肢体、灯光、空间、剪辑与音乐共同爆发。

## A. GPT Image 角色身份板通用提示词

结构顺序必须是：任务 → 参考主体 → 背景 → 设计方向 → 布局 → 身份锁 → 主图 → 辅助研究 → 细节 → 文字 → 禁用项 → 最终目标。

```text
任务：
基于 @[CHARACTER_REF] 创建一张艺术指导级、横屏 16:9 的角色身份研究板，用于后续故事板和视频生成中的人物一致性锁定。

主体：
只研究 @[CHARACTER_REF] 中的同一名角色。不要创造第二套身份，不要把同一角色变成不同年龄、脸型、体型或服装版本。

背景：
纯白或柔和米白背景。无环境、无场景、无道具陈列、无装饰边框、无品牌 Logo、无水印。

设计方向：
不要制作标准工业角色表。采用高端动画工作室角色研究与电影艺术书结合的版式：克制、电影化、精确、具有艺术指导感。

布局：
不对称、优雅、视觉层级清楚；使用大小不同的图像形成节奏，避免规则网格、平均间距、证件照式排列和重复姿势。各研究视图之间留出明确负空间。

重要布局规则：
- 任何图像不得重叠。
- 每个研究视图拥有独立且清楚的空间。
- 不裁切脸、头、手、脚、服装轮廓或关键配饰。
- 不堆叠身体，不合并姿势，不使用不可能的人体结构。
- 每个视图都像独立的角色研究，而不是某个场景的截帧。

身份锁定：
所有视图必须严格保持同一张脸、相同五官比例、相同肤色、相同发型、相同年龄、相同体型、相同服装结构与材质、相同固定配饰、相同视觉气质。不得出现身份漂移。

主图：
设置一张更大的全身 3/4 视图作为视觉锚点，清楚展示角色轮廓、站姿重心、服装结构和核心气质。

辅助研究：
- 全身正面、侧面、背面和 3/4 视图。
- 头肩近景与脸部多角度研究。
- 2–3 个与 @[EMOTION_ARC] 有关的简洁表情；情绪文艺模式以眼神、嘴角、呼吸感和克制微表情为主。
- 2–3 个与 @[ACTION_LANGUAGE] 有关的身体姿态或手势；情绪文艺模式允许静坐、倚靠、缓慢转身、触摸物件等微动作。
- 手部、鞋、服装结构、材质、配饰或关键辨识特征的局部特写。
- 一组简洁黑色轮廓剪影，用于验证轮廓辨识度。

文字设计：
加入一个小型角色 ID 区块，只保留：名称、身份、核心情绪、固定锁定项。文字简洁、大胆、方向明确。仅在确实有帮助的位置使用少量手写箭头和短标签。

禁用项：
第二角色、身份漂移、服装换款、脸部变形、肢体缺失、多余肢体、重复图像、图像重叠、环境叙事、华丽背景、长段文字、乱码、Logo、水印。

最终目标：
生成一张可直接供后续模型理解角色脸部、轮廓、服装、姿态和情绪范围的统一角色身份板。
```

## B. GPT Image 场景锚点通用提示词

每个主要场景单独建立锚点；不要把多个地点混在同一锚点图里。先判断是建筑空间还是自然景观，再选择对应结构。

### 可选：Midjourney 场景视觉母版

- 当用户明确追求电影审美、提供摄影参考，或普通图片模型持续生成泛化风景时，优先用 Midjourney 生成 1–2 张 16:9 场景视觉母版。
- 用户参考图既要影响具体内容/构图时，作为 Image Prompt；只需要继承调色、颗粒、光线与质感时，作为 Style Reference。文字提示直接描述最终画面，不写“复制这张图”之类编辑指令。
- 母版通过后再作为 @\[SCENE_STYLE_MASTER\] 输入场景锚点、故事板和视频节点。不要只用风格码替代用户实际参考图。
- 若当前 LibTV 没有 Midjourney 模型，接收用户在 Midjourney 生成后上传的图片，不调用脚本或外部自动化。

```text
任务：
基于 @[SCENE_REF]、@[SCENE_STYLE_MASTER] 与 @[LOCATION]，创建一张横屏 16:9 的电影场景锚点研究板，用于故事板和视频生成中的空间一致性锁定。严格继承 @[REFERENCE_VISUAL_FACTS]，不得用模型默认审美覆盖参考图。若没有场景参考图，则根据项目文字先建立唯一、可重复拍摄的场景设计。

场景类型路由：
- 若 @[SCENE_ENV_TYPE] = built-environment：固定空间尺寸与拓扑；明确门、窗、走廊、出口、墙面、地面、主要家具、固定陈设与关键道具的位置关系。不得在不同视图中交换、增加或删除固定结构。
- 若 @[SCENE_ENV_TYPE] = natural-landscape：固定地平线/地貌轮廓、地形关系、主导物理运动（风、浪、水流、植被或云层）、天空覆盖、前景元素、主光/碎光、冷暖关系、焦段和人物可活动区域。不得添加室内俯视图、门窗、家具或与参考无关的人工对称构图。

环境锁：
时间、天气、空气状态、主光方向、辅光、色温、材质、主色和地面反射必须一致。明确人物可活动区域和摄影机可拍摄方向。

布局：
- 建筑空间：包含一张完整广角主视图、正反侧辅助视图、简洁俯视拓扑图和固定陈设标注。
- 自然景观：包含一张人与环境关系主视图、一张带前景遮挡的观察镜头、一张地貌/环境材质特写，以及足以说明地平线、地形、主导环境运动和光向的简洁示意；不得做旅游画册式多机位拼盘。
不同视图必须来自同一地点、同一时段和同一套天气/光线条件。

文字：
只保留场景名称、时间/天气、主光方向、固定结构、固定道具和绝对禁止变化项。不要写长段说明。

禁用项：
空间/地貌漂移、固定结构换位、环境状态突变、主导运动反转、光向反转、时间天气突变、无关人物、无关道具、乱码、Logo、水印。必须从当前用户参考中建立专属负面清单；例如用户要求冷调阴天海岸时，禁止橙色日落、金色天空、镜面倒影、热带沙滩、旅游宣传片、对称地平线和过度HDR，但不得把这组海岸限制套用到其它项目。

最终目标：
生成一张能让后续模型稳定理解 @[SCENE_LOCK] 的场景锚点板。
```

### 通用电影风格后缀系统

提示词必须拆成四块，不能把风格、地点和光线全部混成一段：

```text
[CONTENT_BLOCK], [GLOBAL_STYLE_SUFFIX], [LIGHTING_SUFFIX] [MJ_PARAMETER_SUFFIX]
```

- `CONTENT_BLOCK`：当前镜头独有的人物/物体、地点、动作、景别、构图、机位、焦段和前景关系。樱花树、海岸、房间、街道、车站、风、海浪、花瓣、海草都写在这里。
- `GLOBAL_STYLE_SUFFIX`：跨所有地点保持不变的电影年代、媒介、颗粒、色彩响应、对比、景深、镜头观察方式和情绪气质。不得写死具体地点、人物、动作或天气。
- `LIGHTING_SUFFIX`：当前镜头单独选择一种光线，例如 `soft spring daylight`、`overcast diffused daylight`、`warm candlelit interior`、`sodium-vapor night`。互相冲突的光线不得同时出现。
- `MJ_PARAMETER_SUFFIX`：只在 Midjourney 中追加，默认 `--ar 16:9 --raw`。GPT Image 和 Seedance 只保留前三块自然语言，不使用 `--ar`、`--raw`、`--sref`、`--profile` 等 MJ 参数。

本 Skill 默认地点无关的电影风格后缀：

```text
1990s French arthouse cinema aesthetic, poetic realism, muted low-saturation colors, vintage color-negative response, fine organic 16mm film grain, subtle halation, gentle highlight roll-off, restrained contrast, slightly underexposed tonal curve, natural skin tones, tactile analog texture, observational framing, cinematic depth of field, quiet emotional atmosphere, unpolished realism
```

Midjourney 完整通用后缀：

```text
1990s French arthouse cinema aesthetic, poetic realism, muted low-saturation colors, vintage color-negative response, fine organic 16mm film grain, subtle halation, gentle highlight roll-off, restrained contrast, slightly underexposed tonal curve, natural skin tones, tactile analog texture, observational framing, cinematic depth of field, quiet emotional atmosphere, unpolished realism, [LIGHTING_SUFFIX] --ar 16:9 --raw
```

注意：`dappled sunlight`、`candlelight refraction`、`oil painting-like chiaroscuro` 不是通用风格核心。只有当前镜头确实是树下斑驳日光、烛光室内或绘画式明暗时才加入；日间海面、阴天街道等镜头不得机械追加。

同一通用后缀可以用于任何地点。例如：

```text
full blooming cherry tree in an open field, wind moving through the crown, petals drifting across the air, tiny figure standing beneath the tree, wide cinematic shot, 1990s French arthouse cinema aesthetic, poetic realism, muted low-saturation colors, vintage color-negative response, fine organic 16mm film grain, subtle halation, gentle highlight roll-off, restrained contrast, slightly underexposed tonal curve, natural skin tones, tactile analog texture, observational framing, cinematic depth of field, quiet emotional atmosphere, unpolished realism, soft spring daylight --ar 16:9 --raw
```

```text
short-haired woman seen from behind facing a rough grey-blue sea, strong wind moving through her hair and loose clothing, compressed horizon, medium-long-lens cinematic shot, 1990s French arthouse cinema aesthetic, poetic realism, muted low-saturation colors, vintage color-negative response, fine organic 16mm film grain, subtle halation, gentle highlight roll-off, restrained contrast, slightly underexposed tonal curve, natural skin tones, tactile analog texture, observational framing, cinematic depth of field, quiet emotional atmosphere, unpolished realism, overcast diffused daylight --ar 16:9 --raw
```

```text
low viewpoint through wind-blown coastal grass toward dark teal water, foreground leaves softly out of focus, small broken silver reflections across the surface, restrained empty landscape shot, 1990s French arthouse cinema aesthetic, poetic realism, muted low-saturation colors, vintage color-negative response, fine organic 16mm film grain, subtle halation, gentle highlight roll-off, restrained contrast, slightly underexposed tonal curve, tactile analog texture, observational framing, cinematic depth of field, quiet emotional atmosphere, unpolished realism, cool late-afternoon natural light --ar 16:9 --raw
```

## C. GPT Image 12 格总故事板通用提示词

先为整支 30 秒或 40 秒影片生成一张 12 格总故事板。30 秒版每连续 4 格对应一个视频片段；40 秒版每连续 3 格对应一个视频片段。故事板采用 4×3 阅读顺序，从左到右、从上到下。

结构顺序必须是：任务 → 参考身份 → 画布与绘制语言 → 故事核心 → 12 格动作弧 → 摄影语言 → 环境 → 标注系统 → 结尾 → 禁用项。

```text
任务：
为 @[PROJECT_THEME] 创建一张横屏 16:9 的 12 格电影故事板，用作整支 @[DURATION_TARGET] 秒影片的动作、构图、摄影机和情绪总参考。@[DURATION_TARGET] 只能是 30 或 40。

角色参考：
使用 @[CHARACTER_REF] 与 @[CHARACTER_BOARD_REF] 作为角色身份来源。严格保持 @[CHARACTER_LOCK]，不得改变外貌、年龄、体型、服装和固定配饰。

场景参考：
使用当前场景的 @[SCENE_STYLE_MASTER] 与 @[SCENE_ANCHOR_REF] 锁定 @[SCENE_LOCK]。建筑空间保持固定结构与陈设；自然景观保持地貌、地平线、主导环境运动、前景元素、光向、时间和天气连续。场景转换只能发生在明确指定的镜头中。

画布与绘制语言：
12 个电影画面，4 列×3 行，按左到右、上到下阅读。实际绘制以黑白为主：粗粝铅笔线、最少细节、清楚轮廓、简单结构分解。动态表演模式强调快速手势能量；情绪文艺模式强调姿态、目线、负空间、环境变化和克制的微动作。整体像早期电影预演，轻盈且尚未完成，而不是彩色成片渲染。

故事核心：
地点：@[LOCATION]
动作体系：@[ACTION_LANGUAGE]
情绪曲线：@[EMOTION_ARC]
主体目标或视觉命题：@[PROJECT_THEME]

12 格动作弧：
- 1–3 格：建立主体、空间、目线和最初的动作/情绪规则，安静但已有可观察变化。
- 4–6 格：人物关系、物件、光线、摄影机或空间开始发展，出现第一次情绪转折。
- 7–9 格：进入情绪密度最高或最具表现力的阶段；情绪文艺模式可以保持动作克制，但构图、声音或环境明显变化。
- 10–11 格：达到表演、情绪、灯光、空间、色彩或音乐的视听峰值，不强制肢体爆发。
- 第 12 格：以 @[FINAL_POSE] 结束，形成可识别、可停留、具有首尾呼应的终局构图。

变化要求：
每一格都必须包含可观察的变化和不同情绪阶段，不能是毫无差异的重复画面。动态表演模式使用清楚身体动力线；情绪文艺模式可以使用目线、呼吸、手指、衣角、雨水、烟雾、反射、光斑、景深、构图或空间距离等微变化。避免连续相同站姿，但不强迫每格都有大动作。

摄影语言：
- 情绪文艺模式：固定机位、缓慢推进/拉远、克制手持、长焦观察、侧面轮廓、遮挡、反射、空镜、浅景深、长镜头感和极端负空间。
- 动态表演模式：手持能量、快速平移、环绕、顶视、低机位、侵入式近景、长焦压缩和动作匹配。
镜头变化必须服务当前表达模式和情绪，不为了炫技随机切换。

环境：
保持环境最小化，只保留 @[LOCATION] 的核心空间、空气/烟雾/天气、主要光源、地面反射和一个必要视觉母题。不要添加无关布景。

标注颜色系统：
- 红色箭头：主体或身体运动。
- 蓝色箭头：摄影机运动。
- 绿色标记：取景、构图或空间关系。
- 橙色标记：灯光方向与强度变化。
- 紫色标记：声音、音乐重音或情绪强调。
- 黑色文字：简短镜头笔记与面板编号。

标注规则：
故事板图内不写时间码，只写 1–12 面板编号和极短镜头笔记。时间分配在视频生成阶段完成。

禁用项：
彩色成片渲染、过度细节、毫无变化的重复面板、身份变化、服装变化、无关角色、无关场景、漫画对白框、长段文字、乱码、Logo、水印。情绪文艺模式禁止被自动改成夸张哭喊、舞蹈、动作戏或无意义快切。

最终目标：
故事板必须让视频模型能够清楚读取 12 格的镜头顺序、动作阶段、摄影机方向、灯光变化、音乐/情绪重音和最终姿态。
```

## D. 分段故事板参考

12 格总故事板只用于全片规划，不直接同时连接到全部视频节点。生成视频前必须得到片段专用参考：

- 30 秒：S1=1–4，S2=5–8，S3=9–12。
- 40 秒：S1=1–3，S2=4–6，S3=7–9，S4=10–12。

优先使用原生非生成式裁切/拆分，保留原面板像素、编号、构图和顺序。若只能重新生成片段关键帧组，必须同时输入人物原图、角色身份板、当前场景锚点和 12 格总故事板，并逐格核对身份、场景、动作、构图和镜头顺序。每个分段参考只连接对应的视频节点。

## E. Seedance 分段视频通用提示词

截图案例把 12 格压缩成一个 15 秒视频。本 Skill 保留其“故事板锁顺序、角色图锁身份、动作与镜头逐拍执行”的提示词逻辑，并改造成两个可选成片规格。

### 30 秒版

片段故事板范围成片时间功能S1第 1–4 格00:00–00:10建立人物、空间和情绪规则S2第 5–8 格00:10–00:20发展关系并进入核心转折S3第 9–12 格00:20–00:30视听峰值、最终姿态和首尾呼应

### 40 秒版

片段故事板范围成片时间功能S1第 1–3 格00:00–00:10建立人物、空间和动作规则S2第 4–6 格00:10–00:20发展人物、空间、摄影机与情绪S3第 7–9 格00:20–00:30进入核心情绪转折S4第 10–12 格00:30–00:40视听峰值、最终姿态和首尾呼应

每一段都使用下面同一结构，只替换面板范围、动作内容和衔接条件。

```text
任务：
使用 @[SEGMENT_STORYBOARD_REF] 生成片段 [Sx]：横屏 16:9、1920×1080、精确 10 秒。该分段故事板只包含当前片段的连续 3 格或 4 格，是本片段完整的动作、构图、摄影机和情绪来源。不得读取或借用其他片段的面板。

阅读顺序：
严格按故事板原有阅读顺序执行，不重新解释动作，不交换镜头，不改变机位意图，不从其他面板借用动作或构图。

节拍压缩：
按所选时长规格，将当前连续 3 格或 4 格清楚压缩为 10 秒内的连续视听节拍。每个节拍都必须保留可观察变化、摄影机意图和情绪功能。30 秒版每段执行 4 个节拍；40 秒版每段执行 3 个节拍。情绪文艺模式使用克制剪辑、视线/构图匹配、声音桥、缓慢推进或有动机的轻微叠化；动态表演模式可以使用有冲击力的硬切、动作匹配和快速运镜。两种模式都禁止无意义转场。

角色身份：
使用 @[CHARACTER_REF] 锁定脸、年龄和真实身份，使用 @[CHARACTER_BOARD_REF] 锁定发型、体型、服装、配饰和多角度外观，并持续保持 @[CHARACTER_LOCK]。不得改变脸、年龄、发型、体型、服装、配饰或核心神态。

片段动作：
- 40 秒版：把当前 3 个面板分配到 0–3.3 秒、3.3–6.6 秒、6.6–10 秒。
- 30 秒版：把当前 4 个面板分配到 0–2.5 秒、2.5–5 秒、5–7.5 秒、7.5–10 秒。
- 逐节拍写明对应面板的主体动作、景别、机位、摄影机运动、灯光变化、音乐事件与衔接终帧；不得用泛化描述代替每一格的可执行内容。

运动与摄影：
保持故事板的镜头顺序、动静反差和情绪方向。
- emotional-poetic：优先使用呼吸、凝视、转头、手指、触摸、缓慢行走、衣料/头发轻动、雨雾、反射、光线和景深变化；摄影机使用固定观察、缓慢推进/拉远、克制手持、长焦、侧面轮廓、遮挡、空镜和负空间。
- performance-dynamic：可使用旋转、扫动、滑行、爬行、隔离姿态、失衡转移、跃起、跌落或扭转；摄影机可使用快速平移、环绕、顶视、低机位、近景和动作匹配。
不得加入故事板没有支持的新镜头或强度。

环境与视觉：
场景固定为 @[LOCATION]，并直接参考 @[SCENE_STYLE_MASTER] 与 @[SCENE_ANCHOR_REF]。严格保持 @[SCENE_LOCK]，只保留与分段故事板一致的空间/地貌、固定元素、关键道具、空气/天气、主要光源、地面反射和视觉母题。先写当前镜头的内容与唯一光线模块，再在提示词末尾逐字追加 @[GLOBAL_STYLE_SUFFIX]。Seedance 不得携带 @[MJ_PARAMETER_SUFFIX]。保持物理可信的光影和运动逻辑；黑白故事板只锁构图与动作，不得覆盖场景视觉母版的调色和质感。

音乐与情绪：
使用 @[MUSIC_REF] 或 beat map 对齐动作重音、剪辑点、灯光变化和情绪转折。音乐不是随意铺底。

连续性：
若为 S2 以后，使用 @[PREVIOUS_END_FRAME] 作为首帧或连续性参考，继承上一片段的主体位置、朝向、目线、姿态、服装、道具、光向和运动方向；终帧必须精确形成 [NEXT_HANDOFF]，供下一片段直接衔接。若当前模型无法接收尾帧参考，则使用等效连续性关键帧并逐项文字锁定，不得只写“保持一致”。

最终片段规则：
若这是所选规格的最后一个片段，则第 12 格 @[FINAL_POSE] 必须在最后 1 秒保持清楚、稳定而有张力，形成完整结束；不得在最终姿态后添加新动作或多余镜头。

情绪克制规则：
“获得自由、释怀、情绪释放”不自动等于张开双臂、仰头大笑、奔跑、旋转或迎风呐喊。除非用户或故事板明确要求，优先通过目线、呼吸、肩颈放松、停顿、空间距离、风、光线和构图变化完成情绪转折。

绝对避免：
身份漂移、服装变化、面部变形、多肢体、手指异常、无关角色、无关道具、镜头顺序变化、动作重写、空间瞬移、违反物理逻辑、抽帧、黑帧、乱码、字幕、Logo、水印。
```

## F. 第三方风格码规则

参考截图中的 Midjourney `--sref`、`--profile`、`--exp` 等参数属于特定平台与账户，不是可跨模型使用的通用结构。

- 在 GPT Image 或 Seedance 中使用 `[GLOBAL_STYLE_SUFFIX]` 与当前镜头 `[LIGHTING_SUFFIX]` 的自然语言部分，不传入 `[MJ_PARAMETER_SUFFIX]`。
- 只有用户明确提供并要求使用某个可访问的风格引用时，才传入 `[STYLE_REFERENCE]`。
- 不把截图中的具体风格码写死进 Skill，也不保证该风格码在 LibTV 的其他模型中有效。