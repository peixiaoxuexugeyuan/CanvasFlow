# 故事板 Skill · 附录分册

> 📁 **文件定位**：本文件合并了从 `SKILL.md` 抽出的四个小分册——「生成参数」「第零阶段改剧本」「风格插槽机制」「画面风格与电影级词库」（均为控制单文件不超过 2 万字符而拆分，原字未删、只搬位置，现合并回单一附录）。`SKILL.md` 流程主干执行到对应步骤时，按下方各章标题取用，逐字复用、不得凭印象复述。

---

## 生成参数（默认值固定，可按需切换）

| 类型          | 模型（默认）                      | 画质/分辨率（默认） | 比例（默认） | 单条时长上限 |
| ----------- | --------------------------- | ---------- | ------ | ------ |
| 图片（三视图/故事板） | Lib Image 2.5 Pro           | 低画质 1K     | 16:9   | —（图片不涉时长） |
| 视频（默认档）   | Seedance 2.0 Fast（2.0 mini） | 480p       | 4:3    | ≤15s（模型硬上限） |
| 视频（旗舰档）   | Seedance 2.5                | 480p       | 4:3    | ≤30s（可突破 15s，但不得超 30s） |

> 所有图片生成（三视图和故事板）默认使用 Lib Image 2.5 Pro 低画质 1K 16:9；所有视频生成默认使用 Seedance 2.0 Fast 480p 4:3、单条 ≤15s。用户若需「单条 15s~30s」的长镜头，须切到旗舰档 Seedance 2.5（唯一支持原生 30s 的档），此时单条上限 30s。
>
> 🔴 **比例分两层，不得混为一谈**：**画布比例**（整张故事板图的宽高比）＝ 16:9；**分镜格比例**（图内每个分镜格的宽高比）＝ 4:3。二者是「外框 vs 格子」的关系，不是一回事。生成故事板图时，`size/比例` 字段传 **16:9**（画布），分镜格 4:3 由模板正文的「每格 4:3」约束承担（见 `image-prompt.md` 模板正文与负面框「分镜格非 4:3 比例」），**不得把画布比例传成 4:3**。视频侧比例则统一 4:3（与分镜格同宽高比，天然对齐）。
>
> 🔴 **画幅比例受入口问询⑦控制（全程有效）**：⑦选「横屏（默认）」→ 图 16:9、视频 4:3，照上表；⑦选「竖屏 9:16」→ **图片与视频统一改 9:16**（短视频主战场）；⑦选自定义 → 按用户填写比例执行。**切换须在账本该条备注留痕**（「画幅切换：横屏→竖屏 9:16」），且图片侧与视频侧**同画幅、不各自为政**。
>
> 🔴 **视频模型与单条时长上限受入口问询⑧控制（全程有效）**：⑧选「默认档」→ Seedance 2.0 Fast、单条 ≤15s；⑧选「旗舰档」→ Seedance 2.5、单条 ≤30s（可突破 15s 但不超 30s）。**时长上限跟模型走、不跟比例走**——2.0/2.0 Fast 无论什么比例都只能 15s，只有 2.5 能到 30s。选哪档，全剧本视频统一用哪档的模型与时长上限，**不得逐条混用**；切档须在账本备注留痕（「视频档位切换：默认档→旗舰档 Seedance 2.5，单条上限 15s→30s」）。
>
> 🔄 **弹性（不是锁死，是按需切）**：上表是**默认值**，不是「永久固定」。当本次任务有明确需要时——例如需要更高画质出海报级三视图、需要竖屏 9:16 用于短视频、或用户指定了其他模型——**可以按需切换模型 / 画质 / 比例**，切换原则见下。
>
> - **切换时机**：① 用户明确指定；② 该条产出用途要求不同画幅（如竖屏短视频、方形封面）；③ 默认画质不满足某类高精度需求（如角色海报、需放大印刷的定妆图）。除此之外一律沿用默认值，不得为「显得高级」擅自升级画质浪费积分。
> - **切换纪律**：切换**只改参数、不改流程**。模型/画质/比例变了，其余步骤、模板、口径、负面框、校验规则全部不变。🔴 **唯一例外是时长上限**：时长上限**必须与所选视频模型匹配**（2.0/2.0 Fast ≤15s，2.5 ≤30s），不得「选了 2.0 却写 30s」或「选了 2.5 却仍锁 15s」。
> - **切换须留痕**：一旦切换，在账本该条备注里写明「参数切换：原默认 X → 现 Y，原因 Z」。

### 参数字段落地口径（避免 schema 拒绝）

- 图片 `quality` 字段**只填 `low`**（平台 schema 允许值：low / medium / high / xhigh / max）；**禁止**把「低画质 1K」这类描述性文字直接写进 quality 字段——那是给人看的口径，不是字段值。分辨率 1K 由模型默认档位承载，不需要也不应在 quality 里表达。
- 视频的「无音乐」由**两个字段共同实现**：`sound: on`（保留环境音与对白——本 Skill 必写的「环境音设计」与「台词承载音频与口型」两项的载体）＋ `need_bgm: false`（只关背景音乐）。**不得**把 sound 设为 off——那会连环境音与对白一起丢掉，与 `video-prompt.md` 的「环境音设计必写」「台词是音频与口型」直接冲突。
- 自检口径：**`need_bgm: false` 管的是音乐，`sound` 管的是这条视频有没有声音**，两者不是同一件事。

---

## 第零阶段：改剧本（可选，按需触发）

> **这个环节是干什么的**：用户给进来的剧本，常常是「小学生文本」——有情节没张力、有对话没冲突、人物动机不清、情绪压不下来。本 Skill 不能拿这种文本直接进故事板，那等于把一个「没立起来的骨架」拍成「没立起来的成片」。改剧本这一步，就是把粗糙文本**升级成有戏剧张力的成片剧本**，是后面所有环节（锚点、切分、故事板、视频）的地基。
>
> **什么时候触发**：步骤0 入口问询里新增一问「是否要改剧本」——用户选「要」则执行本环节；用户选「不要」或已提供成熟剧本，则跳过本环节，直接进阶段一。**判断原则：剧本是「成品」还是「素材」**——成品（已立骨架、有冲突、对白能立人物）不改；素材（流水账、报幕式交代、对白只会说事不会演戏）则改。

### 改剧本的六条工法（本厂实测，来源：契诃夫/特鲁比/陆军/麦基/Succession，逐字读正文）

改剧本不是「润色辞藻」，是**把戏立起来**。按以下六条逐项过，缺哪补哪：

1. **先立「核心冲突」，不写流水账**：先问一句「这出戏，谁想要什么、谁挡着、为什么非要现在」——这是全剧的发动机。没有这三问，后面再改都是缝补。**特鲁比四角对立**：主角之外，还要有**对手、假盟友、副对手**——光主角 vs 反派是单薄的，权谋戏尤其要「六角对手同时开火」（Gangster 类型节拍）。
2. **对白是行动，不是说明**：每一句台词都要「逼对方回应、推动事情往前走」，删掉所有「报幕式交代」（角色用台词告诉观众「我是谁、我在哪、我要干嘛」）。**麦基场景五步**：每个场景要有「价值转折」——人物带着一个「正值」进场，离开时变成「负值」（或反之），无转折的场景要么删、要么并。
3. **情绪外化，不写内心形容词**：不许写「他很愤怒」「她很悲伤」，要写成身体动作——「攥紧的拳头」「别过脸去」「声音低到几乎听不见」。观众看的是身体，不是情绪名词。
4. **羞辱向下传导（Succession 工法，群像/权谋最对口）**：写不出下一场戏时，问「刚才谁被羞辱了？他身边最弱的人是谁？」——权贵的恶不会悬空，它总砸在更低处的人身上，这就是下一场戏。
5. **道具贯穿链（陆军《桃花扇》工法，历史剧以小见大）**：找一件能反复出场的物件（一柄扇、一枚印、一封信），让它在关键转折处**每次改换身份**——第一次是定情信物，第二次是罪证，第三次是遗物。一件道具七次改身份，比七个新道具更有力量。
6. **删「画蛇添足的升华」**：结尾不喊口号、不点题、不解释「这告诉我们什么」。**契诃夫三层结尾**：事情结束了，但情绪没落地，留一个「还在继续」的余味。戏演完了，人还在路上。

### 改剧本的硬边界（守住，否则改坏）

- **改「戏」，不改「史实与人物立场」**：不得改变历史事实、人物立场、核心事件与情节走向。改的是「怎么把已有的戏演出来、演得有力」，不是「另编一个新故事」。
- **戏剧化与史实的边界判据（防止「加冲突」和「守史实」打架）**：戏剧化改写**可以**补人物动机、给对白上钩子、把流水账改成有冲突的场景、把情绪压成身体动作；**不可以**虚构历史事件、篡改人物立场、添加史实里没有的关键人物或关键事件节点。一句话判据——**「把已有的戏演得更狠」是允许的，「编一个史实里没有的戏」是不允许的**。拿不准某处改动是否越界时，**只改表达、不动事实**，并在这处改动旁标注，交给用户回读时定夺。
- **不擅自扩写新情节**：除非用户明确要求，否则**只强化已有冲突、补人物动机、给对白上钩子**，不新增用户剧本里没有的人物和事件。
- **改完必须回读给用户**：改剧本的结果（改前/改后对照，或直接是改写稿）**必须呈给用户确认**，用户点头后才进入阶段一。这是「剧本」这一环的人工把关点，不静默改、不静默替换。
- **改后产物落文件**：改写稿写入 `scripts/<剧名>-compressed.md`（与压缩稿同路径，作为阶段一的输入），不得只留在对话上下文。

---

## 🔌 风格插槽化（骨架只认「风格声明卡」，新增风格不动骨架）

> **目的（防屎山）**：SKILL.md 的流程骨架与 `image-prompt.md` 的版式模板**不再为单个风格写死分支**。骨架只认一个接口——**「当前风格手册里的声明卡」**。以后新增任何一种风格（游戏引擎实拍、纪录片访谈、二次元…），只需：① 新建一本风格手册，② 手册里带一张标准「风格声明卡」，③ 在下方「风格注册表」加一行。**流程骨架、后缀模板、全局禁止规则一律不动。**

### 风格声明卡（每本风格手册必须带的一节，字段固定四样）

任何风格手册在正文末尾**必须**有一个 `## 风格声明卡` 小节，用固定四字段声明「本风格该怎么填进骨架」：

| 声明字段 | 含义 | 取值示例（Vox） |
| --- | --- | --- |
| **分镜设计表字段** | 步骤3 那张表逐镜列什么 | `镜号｜信息｜转场｜核心视觉想法` |
| **故事板版式指针** | 步骤4 用哪套后缀模板 | `image-prompt.md → Vox 平面分镜版` |
| **着色指令** | 画面风格怎么取/怎么写 | `printed, not lit 材质锁（见本手册第2章）` |
| **核心资产** | 用什么锁变量 | `信息图/图表/地图`（不建三视图） |

> 步骤3「分镜设计表」、步骤4「后缀模板选用」**一律读当前风格的声明卡取值**，不再在 SKILL.md 里为某个风格单写死分支。电影写实（默认）的声明卡 = 六档景别 + 六值运镜 + POV/第三视角两套模板 + 三视图资产，作为基线；TVC、Vox 的声明卡见各自手册末尾。

### 风格注册表（只读索引，新增风格在这里加一行）

| 风格 | 手册文件 | 分镜设计表字段 | 版式指针 | 核心资产 |
| --- | --- | --- | --- | --- |
| 电影写实（默认） | `SKILL-附录.md`（电影级词库）＋`电影风格手册.md` | 镜号｜景别｜运镜 | POV / 第三视角电影分镜 | 三视图＋故事板 |
| TVC 广告 | `TVC广告风格手册.md` | 镜号｜景别｜运镜（权重偏特写） | 第三视角＋特写权重 | 产品多视图 |
| Vox 科普 | `Vox科普风格手册.md` | 镜号｜信息｜转场 | Vox 平面分镜版 | 信息图/图表/地图 |

> **新增风格三步**（不再动骨架）：① 写一本新手册（正文含该风格的取词）；② 手册末尾加一张「风格声明卡」（四字段）；③ 在本注册表加一行。SKILL.md 其余内容、`image-prompt.md` 版式模板、`SKILL-rules.md` 全局禁止规则**全部不动**。

---

## 画面风格与电影级词库

### 画面风格基线（步骤4 唯一定义点，逐字复用）

> 🔴 **默认画面风格 = 冷色调日式，不是暗调好莱坞**：不要一写「电影写实」就往 `low-key / chiaroscuro / 暗部深影` 走——那是欧美黑色电影审美，**不是本厂默认**。`low-key`、`chiaroscuro`、暗调戏剧光只在用户明确点名要「暗调/黑色电影/悬疑」时才启用。

- **基线措辞（逐字复用）**：35mm 电影焦段；自然漫射生活光为主光（光源＋方向＋色温写死：主光写明「来自哪、什么方向、什么色温」，如「窗外天光从左侧漫射，约 5600K」）；冷色调日式清新，低饱和青蓝灰基底、清冷通透，中性偏冷白平衡、约 6000–6500K 微冷日光，画面明亮不压暗、暗部干净通透不死黑，整体克制清冽、不暖不油腻；平实通透、无柔光滤镜、无 halation、无光雾；中等对比、暗部干净（不死黑、不压暗）；中等景深、保留空间纵深；35mm 干净胶片温润密度、不脏不做旧；整体为克制平实的日常凝视温度。
- 🔴 **禁止「暗部压重高光克制」等压暗措辞**，出现即改写为「中等对比、暗部干净不死黑」。
- 画面风格只输出为一段统一文字，全剧本复用，不生成色彩参考图。

### 电影级增强（完整词库）

> 📁 **说明**：本块承载步骤4「电影级增强」的**完整可抄英文词块**。当用户明确要求「电影感」、需叠加五变量技术词块时，**执行前先取本块词，逐字复用，不得凭印象复述**。
>
> 本块由 `SKILL.md` 步骤4 拆分而来，原文未删、只搬位置。

> 🔴 **先纠正一个误读（记死）**：**「纪实」本身就是电影风格的一种**（纪录片、新现实主义、日常凝视这一路），它**不是「不写光、不写焦段」**。纪实风同样要写死「光源＋方向＋色温＋焦段」，只是它的**调色克制、光质自然、不做戏剧化**——所以「默认纪实」与「电影级镜头指令」**不矛盾**：纪实是**调性**（克制平实），镜头指令是**技术底座**（光/焦段/景深照写）。别再把「纪实」误当成「不用写光」。

**🔴 核心结论（一句话记死）**：「电影感」不是写「高级/史诗/电影感」这类形容词，而是写 **5 个可控变量：镜头（lens）→ 灯光（lighting）→ 调色（grade）→ 胶片（stock/纹理）→ 运镜（movement）**。五变量写成一段技术词块，效果远超堆十句情绪形容词。多来源一致：**「密度＞长度」「具名光源＞具名情绪」「报导演名只占 20%，技术簇占 80%」**。

**一、五变量具体英文词（可直接抄，来源：domer.io 七层 + Veo3 五层 + sureprompts 导演拆解）**

| 变量 | 怎么写 | 关键英文词 |
| --- | --- | --- |
| **镜头/焦段** | 写焦段+景深+光学签名 | `35mm anamorphic`（变形宽银幕，椭圆光斑/横光晕）、`85mm`（压缩肖像）、`shallow depth of field`（浅景深）、`oval bokeh`、`vintage spherical prime` |
| **灯光** | 写「光源+方向+质量+色温」，不写「明亮/戏剧」 | 光源 `practical lamp`/`window`/`neon sign`/`overcast sky`；方向 `camera-left`/`back`/`top`；质量 `hard`/`soft`；色温 `warm tungsten`/`cool moonlight`/`sodium vapor`。例：`warm tungsten work lamp from camera left, hard shadow` |
| **调色** | 写具体分级名，不写「好看的颜色」 | `teal-and-orange`（青橙）、`bleach bypass`（漂白留银）、`desaturated`、`lifted blacks`、`day-for-night`、`cross-processed` |
| **胶片/纹理** | 写胶片型号+颗粒+光晕 | `Kodak Vision3 500T`、`Kodak Portra 400`、`Fujifilm Eterna`、`CineStill 800T`、`fine 35mm film grain`、`halation around highlights`、`gate weave` |
| **运镜** | 写具体运动+速度词 | `slow push-in`、`handheld drift`、`slow dolly-in`、`crane up`、`orbit` |

**二、🔴 本厂铁律：Seedance 吃「技术词」，不吃「导演名」**

来源 invideo 官方 FAQ 明确：**Kling、Seedance 2.0 对「报导演名」响应差，对「技术簇」响应好**——写 `Roger Deakins 风格` 不如写 `motivated practical key, warm shadow fill, 2.40:1, shallow depth of field`。**所以本厂视频侧（Seedance）画面风格一律写技术词簇，不写导演名**。**图片侧（img2 / Lib Image 2.5 Pro / Seedream 等图像模型）则相反——图像模型吃导演名/摄影师名/胶片型号这类实体锚点**（LiblibAI 官方口径：AI 不认识「风/感」抽象词，只认导演名、摄影师名、设备型号、出版物封面等实体锚点），所以三视图模板里的「是枝裕和电影质感」是对的、保留。**一句话记死：视频用技术簇、图片用导演名锚。**

**三、导演风格 → 技术簇拆解表（要用某导演的感觉，就抄右边，不写名字）**

| 导演/风格 | 拆成的技术词簇（抄这段） |
| --- | --- |
| **王家卫** | `split-toned amber and emerald, slow shutter motion smear, handheld drift, neon signage bokeh, 2.40:1 hard matte` |
| **维伦纽瓦（银翼杀手2049）** | `cold desaturated grade, teal-and-orange split, fog haze, slow lateral track, negative space, low-key` |
| **Roger Deakins** | `motivated practicals, warm shadow fill, hard side light, subtle lens distortion, tonal restraint` |
| **Wes Anderson** | `flat telephoto, centered symmetry, pastel palette, 90-degree angles` |
| **David Fincher / Khondji** | `desaturated cold tones, deep shadows, controlled symmetry, 85:15 dark-to-light ratio` |

**四、10 个可直接抄的「LUT 风格块」（来源 Veo3 官方调色指南，英文原文，粘贴到提示词末尾即可）**

- **青橙大片**：`Teal-and-orange cinema grade: warm orange skin tones against deep teal-blue shadows, high but smooth contrast, rolled-off highlights, anamorphic 35mm, subtle blue lens flare, fine grain.`
- **怀旧 Super-8**：`Vintage Super-8 home-movie look: warm faded amber grade, lifted milky blacks, low saturation, heavy grain, slight gate weave, soft vignetting, golden afternoon light.`
- **霓虹夜景（CineStill 800T）**：`CineStill 800T tungsten night look: cool blue base with saturated magenta and cyan neon practicals, strong red halation around every light source, crushed shadows, wet reflective streets, 35mm grain.`
- **漂白留银（惊悚/战争）**：`Bleach-bypass grade: desaturated, silver-retained, high contrast with crushed inky blacks and harsh metallic highlights, cold steel-blue cast, gritty texture, hard top light.`
- **日拍夜**：`Day-for-night grade: underexposed two stops, deep blue moonlit cast, cool shadows, a single warm window or streetlamp as the only warm source, soft contrast, subtle grain.`
- **黑白电影**：`High-contrast black-and-white film: rich tonal range, deep blacks with detail, glowing highlights, dramatic side key light, 35mm grain, classic noir chiaroscuro.`
- **柔和独立片（Eterna）**：`Fujifilm Eterna emulation: muted low-contrast pastel grade, gentle desaturated greens, soft natural window light, lifted shadows, delicate skin tones, minimal grain.`
- **黄金时刻浪漫**：`Warm golden-hour grade: honey-amber highlights, long backlit lens flares, atmospheric haze, soft glowing skin, low contrast, Portra-style warmth, 35mm shallow depth of field.`
- **科幻冷峻**：`Cool clinical sci-fi grade: desaturated steel-blue and cyan palette, single warm practical accent, clean high-key fill, sharp anamorphic optics, faint blue halation.`
- **西部/沙漠史诗**：`Sun-baked Western grade: warm dusty ochre and teal sky separation, high overhead sun, hard shadows, slightly faded blacks, fine grain, wide anamorphic vista, heat haze.`

**五、写法顺序（一条画面风格块的标准组装）**

`[镜头] + [灯光源/方向/质量/色温] + [调色名] + [胶片型号+颗粒] + [运镜]`。示例（一句话拼完）：

> `Shot on 35mm anamorphic, shallow depth of field, warm tungsten practical lamp from camera left, teal-and-orange grade with lifted blacks, Kodak Vision3 500T, fine film grain, slow push-in.`

**六、三条避坑（写电影感时最容易踩）**

1. **不要写 `HDR` / `ultra-realistic` / `vibrant`**——这几个词把画面推向「数码塑料感」，正好反着「胶片 filmic curve」走。
2. **不要堆矛盾胶片**：`Portra 400 + bleach bypass + Technicolor` 混在一个提示词里，模型直接糊，一次只选一个风格。
3. **一条只一个主运镜**：`push-in + orbit + whip pan` 叠加必出糊（呼应已有铁律「一镜只取一个方向词」）。

**七、硬约束（叠加时必须遵守，与上文一致）**：① 只写技术词，**不写「高级/史诗/电影感」这类形容词**；② 一次只选一个调色风格，**不堆矛盾胶片**；③ **一镜只一个运镜方向**，不叠加；④ 不写 `HDR / ultra-realistic / vibrant`。
