# Vox 科普风格手册

> 📁 **文件定位**：本文件是故事板 Skill 的**第四条腿**——「Vox 风格（科普/解说/知识向视频）」引擎。故事板 Skill 默认走「电影写实」风格（`电影风格手册.md`），那条腿是**摄影语言**（打光、景深、氛围）；Vox 科普是**平面设计语言**，它**拒绝摄影机**——没有光源、没有景深、没有 3D，画面是"印在纸上"的拼贴。做知识科普/解说/数据可视化时，硬套电影写实那套（景别、运镜、低调光）会彻底跑偏。本手册就是 Vox 的语法。
>
> 🔴 **取词铁律**：本手册所有词汇与规则都**读过正文原文才收录**，逐字复用、不得凭印象改写。核心来源：`aiformortals.co`《I Made a Vox-Style Explainer With One Prompt》（把 Vox 风格逐帧逆向拆解的最硬底本）、`vox-explainer` 开源 skill（六阶段流水线）、`cliptude.com` Vox 风格定义。

---

## 0. 什么时候调用（触发条件）

1. 老大要的是**科普 / 解说 / 知识向 / 数据可视化 / 地图故事 / 新闻解读**——片子的目的是**讲明白一件事**，不是卖产品、不是讲故事。
2. 片子靠**旁白驱动**，画面是旁白的"图解"（地图、图表、大数字、剪贴、时间线）。
3. 老大提到「Vox 风格 / 纸片动画 / 信息图 / 科普动画 / 动态图形」这类词。
4. **不用本手册**：卖产品（走《TVC 广告风格手册》）；讲人物故事、叙事片（走电影写实）。

---

## 1. Vox 与电影写实的本质差异（先想清楚，再动笔）

| 维度 | 电影写实（默认） | Vox 科普 |
| --- | --- | --- |
| **本质** | 摄影语言：打光+景深+氛围 | **平面设计语言**，拒绝摄影机 |
| **光** | 有光源、有高光、有景深 | **无光源、无高光、无景深、无 3D**（printed, not lit） |
| **景别/运镜** | 六档景别 + 六值运镜 | **失效**，换成"信息层级 + 元素运动 + 转场" |
| **节奏** | 情绪弧驱动 | **旁白字数驱动**，画面变化卡在"说出那个词"的那一帧 |
| **核心资产** | 三视图锁人物 + 故事板锁画面 | **信息图/图表/地图/大数字**当视觉底本 |

> 🔴 **一句话判据**：Vox 的镜头是"motion graphics（动态图形），不是 footage（实拍）"——这是它和电影写实最大的分水岭（`vox-explainer` 原文）。

---

## 2. 材质铁律：「printed, not lit」（Vox 的第一命门）

来自 `aiformortals` 原文，这是 Vox 风格的**根**，一句话概括整个视觉：

> **"The whole look is printed, not lit. Nothing has a light source, a specular highlight, a soft shadow falloff, or depth of field."**

逐项拆解（全部原文）：

- **纸底（Ground）**：`a pale halftone paper with a faint grid and visible fibre`（带淡网格和可见纤维的浅色半调纸）。**整条片不变**，它微微"沸腾"，像印刷颗粒。
- **图形（Graphics）**：`flat two-dimensional shapes that behave like printed ink`（像印刷油墨的扁平二维形状）。边缘轻微渗墨，填充带可见的半调网点。
- **照片（Photography）**：`black-and-white archival frames, cropped and pasted flat onto the paper with rough torn white paper edges, as cutouts`（黑白档案照片，剪裁后带**粗糙撕裂的白纸边**平贴在纸上，像剪纸）。低对比、胶片颗粒、灰尘。**它们是"纸上的物件"，不是"通向场景的窗口"**。
- **深度（Depth）**：`none. Everything sits on the page`（没有，一切都平躺在纸上）。物件重叠时是"纸压纸"，带**硬而紧的投影**，**绝不用柔光晕**。
- **调色板（Palette）**：`a muted green land, warm orange-red for heat and emphasis, one bright highlighter yellow used only for numbers, ink black for line and type`——**六种颜色就是全部范围**。黄色最珍贵，**每个节拍最多用一次**（专给数字）。

---

## 3. 字体与高亮条（Vox 的标志性视觉）

来自 `aiformortals` 原文，逐字：

> **Type is bold condensed uppercase black, and where it carries a number it sits on a flat bright-yellow highlight bar** —— 字体是**粗体、窄身、大写、黑色**；带数字时坐在**扁平亮黄色高亮条**上，像荧光笔扫过字下面。

描述给模型时**必须逐字用这句**（每个否定词都是因为"不写就画错"）：

> `bold condensed uppercase black lettering on a flat bright-yellow highlight bar, like a highlighter swipe behind the words: a plain flat rectangle, no border, no rivets, no rounded corners, no shadow, no bevel`

**使用规则**（原文）：

- **只有带数字的节拍才配高亮条**。
- 字幕重复画面已有的内容（草的照片上写"GRASS"）是噪音，**删掉**。
- **只用大字**——小字在生成视频里会糊掉。
- 高亮条**一到就满尺寸、然后定住不动**，不放大、不淡入、不漂移。
- 提示词里文字**用双引号括起来**。
- 🔴 **文字字数红线**：`Keep it under 5 words per frame`（每帧 5 词以内，`vox-explainer` 原文）。要精确的字/大数字，**后期贴**，别让模型硬渲染（这和 TVC 手册第 6 章、电影风格手册的"内嵌文字必乱码"是同一个道理）。

---

## 4. 运动词汇表（带精确时长，Vox 最容易翻车的地方）

来自 `aiformortals` 原文的「Motion vocabulary, with timings」，逐帧实测：

| 动作 | 时长 | 形状 |
| --- | --- | --- |
| 元素入场 | 10-15 帧（0.3-0.5 秒） | 指数缓出，5-10% 过冲，停一次 |
| 入场后保持 | 2-4 秒 | **永不完全静止** |
| 持续漂移 | 整镜 | 约 5 秒内从 100% 缩放到约 105%，或缓慢横移 |
| 纹理沸腾 | 3 帧循环 | 纸和半调网点的抖动，**一直跑** |
| 出场 | 罕见 | Vox 直接切走，几乎不做出场动画 |

两条铁律（原文）：

1. **永不完全静止**——定住的图形仍然在漂移、纸仍然在沸腾。真正静止一秒的画面读起来像"冻结"，微推拉长读起来也像冻结。
2. **入场要干脆、有物理感**——半秒、带过冲。写给模型："drops in from above the top edge, already full size, lands flat with one small bounce"（从顶部边缘外掉进来、已是满尺寸、落地带一个小弹跳）。**绝不用** "slaps down" 或 "pops in"——两者会渲染成"从无到有的缩放"，像 PPT 出现。

**Vox 专属运动词汇（`vox-explainer` 原文，SUBTLE 是关键词）**：

- `slow push-in / pull-out`（**2D 相机**，不是 3D 推拉）
- `parallax drift between cutout layers`（剪纸层之间的视差漂移）
- `clouds/smoke drifting laterally`（云/烟横向漂移）
- `paper elements sliding in from frame edge and settling`（纸元素从画框边缘滑入、落定）
- `halftone dots or texture shimmering gently`（半调点/纹理轻微闪动）
- `a single element animating while everything else holds`（只有一个元素在动，其余全停）

> 🔴🔴 **「只有一个元素在动」≠「画面只放一个元素」（老大纠正，记死）**：这句话的正确理解是——**画面要铺满元素（满屏的纸片零件、箭头、部件、图表、背景纹理），只是"每一拍的运动"只发生在其中一个元素上**，其余元素保持、微微漂移、纸底持续沸腾。**绝不能理解成"画面里只放孤零零一个元素"**，否则就成了又空又慢的废片。
>
> **Vox 的视觉冲击来自三样（补强，做 Vox 必写）**：
> 1. **满屏信息密度**：画面铺满纸片零件、多条箭头、多个部件、地图、图表、大数字——元素要**多**，才不空。
> 2. **入场动势（有方向、有速度）**：纸片不是慢悠悠飘进来，而是**有力度地撕开/翻开/弹出/自己画出来/啪地盖章压上**——见第 5 章转场词汇表，每个转场就是一次小的视觉爆点。
> 3. **节奏强弱交替**：`慢铺垫 → 快揭示 → 顿一下 → 再快`，**不是全程匀速慢**。每次转场/入场就是一次"揭示"，画面变化卡在旁白说出那个词的瞬间（第 6 章）。
>
> 一句话：**Vox 是"满屏纸片 + 有序动势 + 强弱节奏"，不是"极简 + 孤零零慢飘"。** 上一版把"克制运动"误做成"克制成份"，是错的。

**负面约束（每个 prompt 都必须写，逐字，`vox-explainer` 原文）**：

> `no camera shake, no 3D rotation, no morphing of faces or text, no style drift, elements remain flat paper cutouts`

---

## 5. 转场词汇表（Vox 与"幻灯片"的分界线）

来自 `aiformortals` 原文，这是 Vox 风格最独特、最容易做错的部分：

> **"A transition is one thing physically becoming the next, always described as something happening to paper."**（转场是一件东西物理地变成下一件，永远描述成"发生在纸上的一件事"。）

可靠渲染的转场（原文逐字）：

- `the sheet tears down the middle and the halves fall away, revealing what's under`（纸从中间撕开，两半落下，露出下面的）
- `a cutout peels up from a corner like a sticker and lifts off`（剪纸从一角像贴纸一样掀起、揭走）
- `the whole sheet slides away like a page, the next scene underneath`（整张纸像翻页一样滑走，下一场景在下面）
- `a page flip to a new sheet`（翻页到一张新纸）
- `an element is pushed off frame by an unseen hand`（元素被一只看不见的手推出画框）
- `a tint that stamps on like ink`（像墨一样盖上去的色罩）
- `a line that draws itself`（一条自己画出来的线）

**使用规则（原文）**：

- **变换它们，绝不同一条缝连续用两次**。
- **绝对不用**："slides off / slides in"、dissolve、wipe、任何带"transition"字样的——**这些会产出幻灯片**。
- **切是硬的**：Vox 场景之间不溶解，**直接切**。唯一允许短叠化的是"两边是同一场景、画面没对齐"的接缝处，那里用 0.25 秒淡入遮住跳帧，读起来像小故障。
- **最后一帧就是转场**：Seedance 2.5 接受首帧+末帧，把上一个节拍的静帧和下一个节拍的静帧都给它，让它发明中间旅程，把旅程描述成"纸的物理动作"。

---

## 6. 旁白与画面的同步（Vox 的魂，做错就是"旁白配幻灯片"）

来自 `aiformortals` 原文「Narration and picture」，这是 Vox 和电影写实最深的区别：

> **"The picture changes on the words that name the change."**（画面在"说出那个变化"的那个词上变化，不早不晚。）

逐条铁律：

- **画面变化卡在说出变化的那一个词上**，不是之前、不是之后。
- **数字的高亮条落在说出那个数字的音节上**。
- **一行台词在转场开始时开始**——词在变化发生时宣告它，所以转场永远不是"死空气"。
- **两行之间约 0.3 秒的空气**——少了会连成一片，多了是个洞。
- 脚本里说"这一节拍撑过整句"的，就**撑住**，出场的缝在台词说完才动。

**节拍结构（`aiformortals` + `vox-explainer` 原文）**：

- **一个节拍 = 一句旁白（10-17 词，8-14 秒念完）+ 一个视觉想法**。60 秒约 6-8 个节拍。
- **一个节拍一个想法**，想法结束节拍就结束（"One idea per beat, never three"）。
- **数字拼成念出来的样子**（"ninety years" 而不是 "90 years"）。
- 数字要和"它打败了什么"一起引入——比较才是故事，孤零零的数字不是。
- **转折落在约三分之二处**：先立一个显而易见的解释，再点出真正起作用的东西。
- 结尾落在"后果"上，不总结、不回顾。

---

## 7. Vox 叙事弧（冷开场 → 上下文 → 递进 → 转折 → 收尾）

来自 `vox-explainer` 原文：

> cold-open hook（一个意外的具体事实或问题）→ context（"要理解 X，你得回到…"）→ 带一条清晰主线的递进解释 → complication/twist（转折）→ 重新框定开头的收尾。

**旁白声音（`vox-explainer` 原文）**：`measured, warm, slightly wry`（克制、温暖、带点狡黠）——**避开"电影预告片"嗓音**。描述声音会实质改变读法（warm / conversational / curious 这些词各有不同读法）。

---

## 8. 三类内容支柱（Vox 选题的骨架，`cliptude` 原文）

Vox 风格强的选题至少踩中两项：

- **Geography（地理）**：地图、区域、边界、从地球缩到街道。
- **Numbers（数字）**：统计、对比、动画图表、巨型数字。
- **Time（时间）**：时间线、日期、跨越几十年的因果。

> 纯观点、无数据无地点的话题，走 talking-head 或清单体，别硬套 Vox。

---

## 9. Vox 六阶段流水线（完整成片的骨架，`vox-explainer` 原文）

```
TOPIC → 1.Script → 2.Voiceover → 3.Keyframes → 4.Animation → 5.Music → 6.Assembly
```

- **先配音再动画**：旁白时长是整个片子的主时钟，驱动所有时间决策。
- **风格锚模式（style anchor pattern）**：先出第 1 个节拍的关键帧（标题/hook 帧），**审到风格对了再继续**，其余每帧都继承它。用 edit 模型 + 锚图参考：`"Keep the exact art style, palette, paper-collage treatment, and border framing of the reference. New scene: {beat.visual}"`
- **每个 prompt 结尾加风格后缀**（style suffix），编码 Vox 外观：`paper cutouts with white borders, halftone dots, tape strips, bold flat geometric accents, generous margins, single accent color`
- **音乐**：单条器乐床，`is_instrumental: true`（人声会和旁白打架）。配器匹配主题（历史用古筝/笛子，科技用模拟合成器脉冲）。音乐不跟画面弧打架。
- **预算 ~15% 返工率**：文字变形或风格崩坏的片段要重生成。

---

## 10. 融入故事板的落地方式

- 本手册**不替代**故事板 Skill 流程，只替换「画面风格 + 分镜逻辑」这一环：做 Vox 时，阶段一的画面风格**改用本手册的"printed, not lit"材质锁 + 六色板 + 字体高亮条规则**，不再用电影写实的 35mm/低调光/景深词汇。
- **景别/运镜失效**：Vox 的分镜不再是"六档景别 + 六值运镜"，而是**信息层级**（一个节拍一个视觉想法：地图/图表/大数字/剪贴），运镜换成**元素运动 + 纸转场**。这是本手册与故事板现有分镜语言最大的差异，做 Vox 时**必须切换、不得混用电影写实的景别运镜**。
- **旁白字数驱动节奏**：时长不再按"台词字数÷5"，而是**先录旁白、用旁白时长定每个节拍的画面时长**。
- **三视图基本用不上**（没人出镜），换成信息图/图表/地图当视觉底本。

> 🔴 **一句话**：Vox 是"印在纸上的动态图形 + 旁白词级同步"，电影写实是"摄影机的光与影"。两套语法，做哪种就用哪种，**不混**。

---

## 风格声明卡（骨架读这一节，新增风格照此格式）

> 供 `SKILL.md` 步骤2/3/4 读取值。四字段固定，含义见 `SKILL.md`「风格插槽化」一节。

| 声明字段 | 本风格取值 |
| --- | --- |
| **分镜设计表字段** | `镜号｜信息｜转场｜核心视觉想法一句话`（**景别/运镜失效**，「信息」取本手册第 2 章信息层级，「转场」取第 5 章转场词汇表） |
| **故事板版式指针** | `image-prompt.md → Vox 平面分镜版`（**不参与 POV/第三视角二选一**） |
| **着色指令** | `printed, not lit` 材质锁（见本手册第 2 章：半调纸底＋六色板＋粗体窄身大写黑字坐亮黄高亮条） |
| **核心资产** | 信息图 / 图表 / 地图（**不建人物三视图**） |
