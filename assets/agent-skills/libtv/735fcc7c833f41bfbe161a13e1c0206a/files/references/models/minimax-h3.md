# 模型 · MiniMax H3（海螺）

> **定位**：15 秒一镜到底的写实叙事强手，电影质感最好，运镜稳。适合情绪片、品牌片、写实短剧。

---

## 1. 硬约束

项值单次时长**15 秒**（一镜到底，不做硬切）底模（全参考）`minimax_h3_ref2va_*`底模（基础）`minimax_h3_fl2va_*`（T2VA / I2VA / FL2VA / L2VA 共用）正文语言**英文**段落顺序固定六段，不许调序

15 秒一镜到底意味着：段内没有切点，叙事全靠**运镜 + 走位 + 光的变化**。

---

## 2. 文件头四块（写之前先立）

各占一整行，不许手动断行：`MODE / DURATION / CAMERA RULE / LIVING-SCENE RULE / FILM STYLE`

```text
FILM STYLE: photorealistic live-action, 35mm film grain, soft halation on practicals, gentle vignette, warm-leaning color science, shallow depth of field, natural skin texture
```

---

## 3. 一镜到底写法（15 秒）

不写 `Shot 1 / Shot 2`，写**节拍时间戳**并声明无硬切：

```text
CAMERA RULE: one continuous take, no hard cuts, no dissolves. Move the story with camera motion, blocking and light change only.

detailed_description:
00:00–00:03  <起幅：景别 + 主体 + 环境压力 + 微动>
00:03–00:07  <摄影机缓慢推进 / 主体走位，情绪加压>
00:07–00:11  <转折：新信息进入画面>
00:11–00:15  <落点：最后一帧看到什么，光如何变化>
```

> 用节拍时间戳时整段只有一个镜头：凡模板里出现 `[Shot 1]` / `[Shot N]`，`N` 一律取 `1`（如 FL2VA 指令行写 `Picture 2 (from Shot 1) aligns with the 15.00-second mark`）。

---

## 4. 防虚影（最容易翻车的地方）

**只许写**：`slow` / `steady` / `gradual` / `constant gentle speed`。\
**禁止**：`fast`、`rapid`、`whip`、`quick zoom`、快速旋转、手持剧烈晃动。\
虚影一旦出现整段作废，重生成比后期修便宜。

---

## 5. 活体画面（定镜也不能死）

H3 对完全静止的处理会流成幻灯片，**每一镜都必须写死一条微动**：

场景微动人物手势、交谈、举杯、呼吸起伏、眨眼、重心微移光源烛火摇曳、灯丝轻跳、屏幕光闪一下环境窗帘呼吸、水面细波、蒸汽上升、尘埃在光柱里飘材质布料随呼吸起伏、发丝被风带起一缕

```text
LIVING-SCENE RULE: even in locked-off frames, keep micro-motion alive — breathing, a single blink, curtain movement, candle flicker, dust drifting in the light beam. No frozen-frame look.
```

---

## 6. 五模式：判定

判定在内部完成，不在交付里解释。先清点附件，以及措辞给每个附件派的角色：图片看 `首帧 / 第一帧 / 从这张开始 / 结尾 / 定格 / 参考这个角色 / 参考风格 / 分镜 / 照着这张改`；视频看是编辑源、续写起点还是运镜节奏参考；音频看是音色、音乐风格还是对白复用。

观察到的情形模式纯文字，无附件**T2VA**一张图在开场位置（明说，或只有一张且无其他角色）**I2VA**两张图，一张起点一张终点**FL2VA**一张图被指为结尾 / 定格 / 最终画面**L2VA**任何视频或音频附件**Ref2VA**图片角色异构：人物+场景、风格+主体、覆盖多镜的分镜图，或明说 `换人 / 角色统一 / 风格迁移 / 视频编辑 / 续写`**Ref2VA**单张图被当成多镜的调度参考（分镜图）**Ref2VA**既有当具体帧用的图，另有只当主体/风格源的图**Ref2VA**

**优先级（命中即停）**：

1. 有视频或音频 → Ref2VA（基础模式表达不了音频关系与整片时序）。
2. 附件角色异构 → Ref2VA（不同主体/场景/风格是参考，不是同一动作的两个时刻）。
3. 两图都是边界帧 → FL2VA；只点一个边界，按点的那个定（开场 I2VA / 结尾 L2VA）。
4. 一张图、角色未说明 → I2VA（默认 0.00 秒那帧）。5. 无附件 → T2VA。

**输出骨架**：

模式第一行之后T2VA`integrated_multimodal_description:overall_soundscape:` → `non_diegetic_music:`I2VA / FL2VA / L2VA该模式的对齐指令行空一行，同样三字段Ref2VA`subject_definitions:summary:` → `retention_analysis:` → `detailed_description:` → `overall_soundscape:` → `non_diegetic_music:`

最后一个字段之后不再加任何东西。模式名、判断理由、字数、自检结果一律不写进交付。

---

## 7. 通用规则（所有模式共用）

### 7.1 镜次与切点

第一镜不加时间戳；后续镜次递增编号，并以严格递增、落在时长内的切点开头：

```text
[Shot 2] At 00:03.500, the camera cuts to...
```

常规切用 `the camera cuts to` / `the shot cuts to` / `the shot transitions to` / `the shot changes to` / `the shot switches to`；用户明确要求时才用叠化、淡入淡出、划像。切点必须带来新信息（主体、空间、状态、视角、时间）；只变距离或轻微角度，改用运镜。

### 7.2 运镜：类型 + 幅度 + 速度

**运动类型**：`Zoom In/Out`（变焦）· `Push In/Pull Out`（前推/后拉）· `Pan Left/Right`（摇）· `Truck Left/Right`（横移）· `Tilt Up/Down`（俯仰）· `Pedestal Up/Down`（升降）· `Arc Shot`（弧移）· `Tracking Shot`（跟移）· `Static Shot`（定镜）· `Shake Slightly/Strongly`（晃）· `POV` · `Roll Clockwise/Counterclockwise`（滚转）\
**幅度**：`with small amplitude` / `with large amplitude`**速度**：`at slow speed` / `at fast speed`

幅度与速度只在有意义时写，中等幅度与常速省略。运镜要写成句子里的自然动作，不能堆成句尾标签：

```text
The camera pushes in with small amplitude at slow speed toward the folded letter in her hands.
The camera holds a static shot as the runner exits the frame.
```

> 与 §4 的关系：H3 只取慢档，`at fast speed`、`Shake Strongly`、`Quick Zoom` 禁用。

### 7.3 说话人、对白、旁白、歌唱

发声/歌唱/产生画外人声的主体用稳定 ID `(S1)`、`(S2)`；多人同时发声用复合 ID `(S1,S2)`；跨镜保持同一 ID，不发声的角色不给 ID。

说话人首次出现时，给足确立身份的信息：角色类型、年龄、性别、是否在画内、音高、音色、语速、口音。**身份短语、ID、动作、语气放在** `<d>` **外面**；`<d>` 内只放语言标签与用户原话，逐字保留、不翻译不改写。

```text
The young woman with a quiet, breathy voice (S1) says: <d>[English] I get off at the next station.</d>
The two children (S1,S2) shout together, <d>[English] Wait for us!</d>
```

画外旁白必须用完整短语 `says in an off-screen voiceover`，并在每个旁白 `<d>` 之后立刻声明画内人物嘴唇闭合：

```text
The man (S1) says in an off-screen voiceover: <d>[English] I still remember that road.</d> while his lips remain completely closed.
```

台词或歌词跨切点时，前后两段接缝处都写 `<scenetrans>` 并说明声音跨切延续；被片尾截断写 `<cutoff>`。延续可用 `continues seamlessly across the cut`、`carries over from the previous shot`。

`(Sx)` 按实际发声事件先后一次性编定，之后每次发声复用，**不许在镜次之间重编**。

### 7.4 画面文字

真实可见的横幅、招牌、标签、字幕、霓虹字，放进英文双引号，原文与标点逐字保留、不翻译。

```text
A red neon sign reading "营业中" glows above the doorway.
```

### 7.5 语言纪律

正文一律英文；只有 `<d>` 内对白歌词与画面可见文字保留原语种。每镜写清：构图、主体、环境、动作、摄影机、声音，以及参考内容**具体在哪一刻出现**。

---

## 8. 基础模式：指令行 + 三字段

### 8.1 指令行（T2VA 没有）

**I2VA** 固定用：

```text
For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.
```

**FL2VA** 固定用：

```text
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.
```

**L2VA** 固定用：

```text
How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.
```

`N` 是实际末镜编号（一镜到底时恒为 `1`），`S.SS` 是本段实际时长，**两位小数**（15 秒写 `15.00`）。指令行必须是第一行，后空一行再进三字段。

### 8.2 三字段

```text
integrated_multimodal_description: [Shot 1] ...

overall_soundscape: ...

non_diegetic_music: ...
```

- **integrated_multimodal_description**：沿时间轴写画面、动作、镜次、说话人、对白、歌唱与画内同期声。
- **overall_soundscape**：概括全段环境声、物理动作声、非语言人声。
- **non_diegetic_music**：只有观众能听到、角色听不到的配乐。

### 8.3 关键帧怎么进正文

**I2VA**：`<Picture 1>` 就是 0.00 秒的第一帧，属于 `[Shot 1]`。先立住图里的风格、主体、构图、场景锚点，再写下一个动作；身份、服装、颜色、关键道具、空间关系保持一致。结构：**首帧锚定 → 动作起势 → 连续发展 → 结果或反应**。

**FL2VA**：Picture 1 是开场、Picture 2 是收场。重点写主体怎么动、姿态怎么变、道具怎么被操作、构图怎么演化、场景与光怎么过渡。H3 一镜到底天然适合 FL2VA，不要擅自加镜；末帧必须在片尾抵达。结构：**首帧状态 → 可见中间变化 → 差异逐步收敛 → 末帧状态**。

**L2VA**：`<Picture 1>` 是末帧，属于最后一镜，天然不属于第一镜。先按意图与末帧倒推一个可信的先前状态，再写人物、物件、摄影机、场景如何逐步逼近参考图。结构：**可信先前状态 → 动作与过渡路径 → 末镜逐步收敛 → 落帧**。

### 8.4 三字段怎么写

**正文**：每个细节都要对应看得见或听得见的东西。在开头交代整体风格与起始构图，常用风格 `Cinematic`、`live-action`、`2D-animated`、`3D CG`、`claymation`、`watercolor`、`vintage film`（关键帧任务从参考图推，T2VA 从文本选）。

```text
[Shot 1] Live-action, cinematic, a medium-wide shot frames...
```

**overall_soundscape**：1–4 句英文、一段连续文字，写环境声、物理动作声、非语言人声（风、雨、车流、脚步、布料摩擦、撞击、呼吸、笑、喘）。对白、歌唱、画内音乐已在正文，**不在这里重复**。只有明确要求全片静音才写 `N/A`。

```text
overall_soundscape: Steady rain taps against the café windows while low room ambience continues underneath. The entrance bell rings once, followed by wet footsteps and the soft scrape of a chair.
```

**non_diegetic_music**：1–3 句英文，写角色听不到的配乐。只写器乐、速度、节奏、力度变化；**不用抽象情绪词，不解释配乐的情感功能**。角色能听到的歌唱、乐器、收音机、电视、手机音乐属于画内事件，写进正文。没有配乐写 `N/A`。

```text
non_diegetic_music: Sparse piano notes at a slow tempo, joined by sustained low strings that gradually increase in volume before fading out.
```

### 8.5 完整案例（I2VA）

```text
For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.

integrated_multimodal_description: [Shot 1] Live-action, cinematic, the young woman shown in <Picture 1> remains beside the rain-covered train window, preserving her appearance, clothing, seat position, and the carriage layout. The camera trucks right with small amplitude at slow speed as she lifts her gaze from the folded letter toward the passing city lights. Her reflection moves across the glass while the quiet, breathy young woman (S1) says: <d>[English] I get off at the next station.</d> She folds the letter along its existing crease.

overall_soundscape: The train wheels produce a steady metallic rhythm beneath a low ventilation hum. Rain ticks against the window while paper rustles softly in her hands.

non_diegetic_music: Sustained cello notes at a slow tempo with widely spaced piano tones, gradually decreasing in volume.
```

---

## 9. 全参考模式 Ref2VA：六段式

处理换人、视频编辑、续写、风格迁移、音频复用。六段一律英文，只有 `<d>` 内对白歌词与画面可见文字保留原语种。

`detailed_description` 要尽可能细：每镜立住当前构图、主体外形与位置、环境与光、动作与状态变化、摄影机运动、当前声音，以及参考内容真正出现或生效的位置。**不要退化成剧情摘要或参考关系清单。** 镜次、运镜、说话人的语法同 §7。

### 9.1 结构

段作用`subject_definitions`定义参考内容与其标签`summary`概括任务类型、目标视频、主要参考关系`retention_analysis`参考内容如何被保留、转移或复用`detailed_description`按播放顺序写画面、动作、镜次、声音、对白`overall_soundscape`概括环境声与物理声`non_diegetic_music`只有观众听得到的配乐

### 9.2 四类标签

标签含义`<Subject N>`从参考素材抽象出来、可在目标视频里复用或改造的可见内容`<Picture N>`当作具体目标帧或调度锚点的参考图`<Video N>`提供编辑源、续写起点或整片时序结构的参考视频`<Audio N>`被复制或引用的音频信号

标签一旦指派，含义在六段之间**全程不变**。

`subject_definitions` 逐条定义后面要单独追踪的参考内容（人物、环境、源视频结构、音轨），一条一行，写清标签指向什么、扮演什么角色、跟随哪些主要特征。若 `<Picture N>` / `<Video N>` 只是另一条内容的出处、后面不会单独分析，**写进那条定义里，不单开一行**。

`<Subject N>` 用于可复用的可见内容：人物/动物/物件、场景/环境、服装/道具/特效、风格/动作/表情/姿态。代表"会被真正用进目标视频的内容单元"，不是源文件本身。一个主体可由多份素材定义，一份素材也可提供多个主体。

```text
<Subject 1> is the young woman in <Picture 1>, with long dark hair, a blue cardigan, and a thin silver necklace.
<Subject 1> is the woman whose appearance comes from <Picture 1> and whose walking motion comes from <Video 1>.
```

`<Picture N>` 只在参考图本身充当某镜的首帧、关键帧、末帧、改后关键帧或构图锚点时单开一行；只用来定角色/场景/服装/风格时，把出处写进对应 `<Subject N>`，**不单开图条目**。

```text
<Picture 2> is the first frame of [Shot 1], showing a woman seated beside a café window.
<Picture 3> is a storyboard reference for [Shot 1] and [Shot 2], defining their viewpoint, subject placement, and shot order.
```

`<Video N>` 只用于整片关系：编辑原视频、从原视频结尾续写、参考其运镜/剪辑/节奏/时序结构。

```text
<Video 1> is the source video for the target video edit.
```

参考视频里的人、物、场景、动作、特效被当可见内容复用时仍归 `<Subject N>`；`<Video N>` 标的是素材或结构来源，**不替代主体标签**。

`<Audio N>` 代表独立音频素材或参考视频中启用的同步音轨，用于：整体/部分复制音频、参考配乐风格、参考说话人音色与语气、复用原对白/歌词/音效、参考节拍与延续性。

明确对应某目标说话人时，定义里复用其全局 ID：对应已定义主体写 `<Subject N> (Sx)`，否则用稳定音色描述加 `(Sx)`；该 ID 来自目标视频的全局发声顺序，**不另行指派或重编**（见 §9.5）。一份音频承担多个角色时用一句话说清，不拆小节。

```text
<Audio 1> is the voice-timbre reference for <Subject 1> (S1).
```

`<Video N>` 与 `<Audio N>` **各自独立编号**，编号只表示本类内的顺序，不编码配对关系（同一参考视频可以对应 `<Video 1>` 与 `<Audio 2>`）。普通参考视频**不会因为文件里有声就自动产生** `<Audio N>`。`<Audio N>` 定义不必点明出处，只在可能混淆时才补：

```text
<Video 1> is the source video for the target video edit.
<Audio 2> is the synchronized audio track of <Video 1> and is reused in the target video.
```

### 9.3 `summary`

一段简短英文，概括目标视频与参考关系，开头是方括号任务类型前缀：

```text
[reference generation] ...
[video editing + reference generation + audio reuse] ...
```

任务类型何时用`keyframe completion`图片充当首帧、关键帧、末帧、改后关键帧或其他具体帧锚点`reference generation`图/视频/音频为角色、场景、风格、动作、运镜、分镜提供指引，但不当具体帧、也不是被编辑或续写的源视频`video editing`直接修改既有源视频；改图或在两静帧之间生成不属于此类`video continuation`新内容接续、延长、重启或转出既有源视频`audio reuse`同一音频信号整体或部分复用`audio reference`不直接复制，只参考其音乐风格、音色、对白或歌词内容、音效质感、节拍或延续性

多重关系用 `+` 合并，**同一类型不重复**：`[video continuation + keyframe completion]`、`[video editing + audio reuse]`。

有视频/音频不等于自动成立对应类型：只提供运镜、剪辑、节奏时属于 `reference generation`；真正被编辑或续写才用 `video editing` / `video continuation`。编辑源视频且原声仍可闻时加 `audio reuse`；续写但不复制信号、新音频只延续原轨听感时用 `audio reference`。

`summary` 只用已定义标签，**不引入新标签**。视频编辑任务在类型前缀后以这句开头：

```text
The target video is an edited version of <Video 1>.
```

### 9.4 `retention_analysis`

逐条说明每份参考内容如何被保留、转移、复制或引用，**每个标签一行**，含义与 `subject_definitions` 一致。

可见内容（`<Subject N>` / `<Picture N>` / `<Video N>`）：

标记含义`fully_preserved`既定角色被完整保留`partially_preserved`仍在用，但部分特征被改变或只留一部分`attribute_transfer`参考特征被转移到另一个可辨识的目标主体`weak_reference`只保留风格、类别、构图或氛围上的大致相似

```text
<Subject 1> (appears in [Shot 1], [Shot 3]): fully_preserved - ...
<Picture 2> ([Shot 1] first frame): fully_preserved - ...
<Video 1> (cut and pacing structure): weak_reference - ...
```

音频（`<Audio N>`）用另一套：

标记含义`fully_copy`完整源音频作为目标视频完整的最终音轨`partially_copy`只复制部分时间轴或音层，或复制后又增删替换`reference`不直接复制，只参考音色、节奏、音乐风格、对白内容或声音质感`weak_reference`只保留类别或氛围上的大致相似

```text
<Audio 1>: fully_copy - <Audio 1> is reused 1:1 as the target video's complete final audio track.
<Audio 2>: reference - the target speaker follows <Audio 2>'s voice timbre and measured delivery without copying the original signal.
```

标记只能在该标签**已在** `subject_definitions` **定死的角色范围内**选。目标视频新加的动作、背景、情节事件**不算保真度损失**。

### 9.5 `detailed_description`

按播放顺序逐镜写画面、动作、声音、对白，并在生效处插入参考标签。

- 正文英文；对白、歌词、可见文字保留原语种。
- `[Shot 1]` 无时间戳；后续写 `[Shot N] At MM:SS.mmm, ...`。
- 运镜写成镜内自然英文，需要时带类型、幅度、速度。
- 发声源给稳定 `(S1)`、`(S2)`…，对白歌词写进 `<d>[Language] ...</d>`。
- 跨切对白用 `<scenetrans>`，片尾截断用 `<cutoff>`。

**与 T2VA 的四处差别**：

维度T2VARef2VA主字段`integrated_multimodal_descriptiondetailed_description`风格交代写在 `[Shot 1]` 之后在 `[Shot 1]` **之前**用 1–2 句立住参考信息不用全参考标签首次出现处与生效处插 `<Subject N>` / `<Picture N>` / `<Video N>` / `<Audio N>`音频关系只写目标视频自己的声音在对应镜或音频阶段引 `<Audio N>`，并说明是复制还是引用

```text
The target video is in a cinematic, literary music-video style with soft lighting and a slightly desaturated color palette.
[Shot 1] The scene opens in a crowded urban street...
[Shot 2] At 00:09.000, the shot cuts to an extreme close-up...
```

生成类任务正文通常 **350–500 英文词**；对白密集的内容优先写全口述时间轴，不机械凑字数；视频编辑类按源视频复杂度伸缩。**单镜不等于可以少写**。

**标签在镜内怎么用**：重要 `<Subject N>` 首次清晰出现时，写清参考特征、画面位置、当前动作，限定在镜内真实可见的范围内；后续继续用同一标签，**不重新定义**。帧锚点用自然措辞：

```text
the shot begins from <Picture 1>
the shot's keyframe corresponds to <Picture 2>
the shot ends on <Picture 3>
```

编辑或续写原视频时，在源状态、结构或续写关系生效处引用 `<Video N>`；在音频关系生效的镜或语义阶段引用 `<Audio N>`。

**说话人与对白**：基础 ID 与 `<d>` 格式同 §7.3。被引用主体亲自说话时，视觉标签与说话人 ID **两个都留**；主体画外发声保持同一形式并标 `off-screen`；说话人不属于任何已定义主体时，用稳定音色描述加 `(Sx)`。

```text
<Subject 2> (S1) turns toward the woman and says, <d>[English] Last summer, I went to my grandfather's house. He talked about you.</d>
```

语言内容只是直接复用的 BGM 或完整音轨里的一句提示、且没有独立声源在物理发声时，用 `<Audio N>` 当可闻来源，**不要凭空再造** `(Sx)`；若有具体人物/角色/旁白在发声，则为该声源指派并复用 `(Sx)`：

```text
When <Audio 1> reaches the phrase <d>[English] I'm lonely lonely lonely lonely lonely I'm lonely</d>, <Subject 1> performs the corresponding hand gesture without becoming a separate speaker source.
```

参考音频的对白、旁白、歌词被直接复用或明确要求重演时，`<d>` 内**逐字保留原词与原语种**；听不清写 `[unclear]`，不猜不改写；标点统一为 `,` `.` `?` `!`，去掉重复波浪号、表情符号、项目符号与装饰性标点；完整陈述/疑问/感叹在 `</d>` 前分别以 `.` `?` `!` 收尾。只参考音色、节奏、情绪或语气时，**不要把原对白搬进目标视频**。

`(Sx)` 按实际发声事件顺序一次性编定并全程复用；`subject_definitions` 里绑定到说话人的 `<Audio N>` 也复用同一 `(Sx)`，**绝不独立新编**；`retention_analysis` 里**不写** `(Sx)`。

### 9.6 两个声音段

`overall_soundscape` 概括全片环境与物理声；对白、歌唱与绑定具体镜次的声音事件留在 `detailed_description`。`non_diegetic_music` 写角色听不到、只有观众听得到的配乐，说明器乐、速度与力度发展。

```text
overall_soundscape: Quiet indoor room tone and a low ventilation hum continue throughout the video.
non_diegetic_music: A restrained solo-piano score at a slow tempo, with sustained low cello underneath and no swell.
```

用了参考音频时，复制或引用关系只写在**与可闻层相符的那一段**：环境声与音效归 `overall_soundscape`，观众听的配乐归 `non_diegetic_music`；同一音频承担两类内容时两段各写：

```text
overall_soundscape: The copied ambience layer from <Audio 1> continues throughout the target video.
non_diegetic_music: <Audio 2> is directly reused as the complete audience-only score.
```

完整对白与歌词只写在 `detailed_description` 的 `<d>` 里，这两段不重复。

### 9.7 完整示例（3 镜）

```text
subject_definitions:
<Subject 1> is the rain-soaked platform in <Picture 1>, with a tiled canopy, a vending machine glowing at the far end, and standing water on the tiles.
<Subject 2> is the young woman in <Picture 2>, with shoulder-length damp hair, a grey wool coat, and a canvas tote bag.
<Audio 1> is the station ambience reference, containing a low ventilation hum and distant announcements.

summary:
[reference generation + audio reuse] The target video places <Subject 2> on <Subject 1> at night: she waits, takes a call, then walks toward the stairs as a train arrives. <Audio 1> supplies the ambience layer.

retention_analysis:
<Subject 1> (appears in [Shot 1], [Shot 2], [Shot 3]): fully_preserved - the canopy, vending machine and standing water are retained.
<Subject 2> (appears in [Shot 1], [Shot 2], [Shot 3]): fully_preserved - hair, coat and tote bag retained; the coat gains rain sheen from Shot 2.
<Audio 1>: partially_copy - the hum layer is reused 1:1 while the announcements are re-timed.

detailed_description:
The target video is a cold, photorealistic night scene: wet reflective tiles, one hard fluorescent key from the canopy, roughly 70% of the frame unlit.
[Shot 1] A wide static shot establishes <Subject 1>: an empty platform under a tiled canopy, a vending machine glowing pale blue at the far end, standing water mirroring the ceiling tubes. <Subject 2>, the young woman with damp shoulder-length hair and a grey wool coat, waits at the yellow line, tote bag on her right shoulder. The camera pushes in with small amplitude at slow speed; she shifts her weight, breath fogging faintly, the coat hem stirring in the downdraught. The hum from <Audio 1> runs under the shot.
[Shot 2] At 00:04.000, the shot cuts to a left-side medium close-up: rain beading on her coat shoulder, one damp strand stuck to her cheek. She raises the phone to her ear. <Subject 2> (S1) says in a low, flat voice, <d>[English] I'm not coming tonight.</d> A muffled announcement enters under the line. She lowers the phone and her lips press together.
[Shot 3] At 00:09.000, the shot cuts to a low wide from the far end of the platform. She walks away from camera toward the exit stairs, her reflection stretching across the wet tiles. The camera holds static as an arriving train's headlight sweeps the canopy, washing the frame in a moving band of warm light that ends on her silhouette against the stairwell glow.

overall_soundscape:
Wet platform ambience continues throughout, with water dripping from the canopy edge and the low ventilation hum carried over from <Audio 1>.

non_diegetic_music:
A single sustained low string at a slow tempo, entering after the call and fading before the train light reaches her.
```

> 上例 `detailed_description` 约 240 词（3 镜）。**密度即标准**：每镜 60–80 词、逐镜写构图/主体/环境/动作/摄影机/声音；镜数补到 5–6 镜，自然落在 350–500 词。少于 5 镜却写不到 350 词，说明细节不够，回去补光位、动作、声音。

---

## 10. 接进分段表

```bash
python scripts/plan_timeline.py --total 300 --model h3 --aspect 9:16
```

输出 20 段 × 15s，每段带功能标签与首帧文件名。之后：① 每段首帧按 `04-image-chain.md` 出图（或从上一段导尾帧）；② 每段写六段式提示词（正文英文，每字段一整行）；③ 跑 `check_prompt.py` 体检（查三细节、身份块、时序）；④ 剪辑里按 L1–L5 接。

**长片接法**：H3 一段只有 15s，5 分钟 = 20 段。用 **L4 尾帧续写**（`06-longform-5min.md` §8）接成"好像一条长镜"，或用 L1 硬切换幕。

---

## 11. 失败模式

现象原因修法画面发虚 / 鬼影运镜词太快全改 slow / steady / gradual像幻灯片缺微动每镜补一条活体微动段落顺序被忽略六段乱序或合并严格按 subject → summary → retention → detailed → soundscape → music15 秒塞太多事件一镜承载有限一段只完成一个功能，多事件拆段身份漂移缺 retention_analysis身份、服装、光、道具状态逐条写进该段段与段接不上没用尾帧上一段导尾帧作下一段 I2VA 首帧参考图被当成首帧模式判错图只提供角色/风格时走 Ref2VA，用 `<Subject N>` 定义对白跨段被截断没用 `<cutoff>` / `<scenetrans>`跨切用 `<scenetrans>`，片尾截断用 `<cutoff>`

---

## 12. 什么时候不用 H3

段内多镜快切 → Seedance / Kling 4.0；多角色对话 + 口型 → Kling 4.0 / Veo；30 秒一条过 → Seedance 2.5 / Kling 4.0；跨集不换脸与音色资产库 → Kling 4.0（Saved Elements）。H3 的强项是**一镜到底的写实情绪段落**。

---

*H3 适配层 + MiniMax H3 提示词体系（五模式 / 六段式 / 标签系统），不含第三方授权内容。*