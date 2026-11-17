# 04 · 图像链：先出设定图，再出视频

> **为什么必须先出图？**
> 一，省钱：一张图比一段视频便宜一个数量级，风格错了重画一张，别重生成一段。
> 二，锁脸：视频模型跨次生成没有记忆，唯一可靠的"记忆"就是你手动喂给它的首帧图。
> 三，可沟通：用户看图能说"不对，换"，你给他一段视频他只会说"怪怪的"。

**链路：一句话 → 角色设定图 → 场景设定图 → 关键帧（首帧）→ 视频段。**

---

## 目录

1. 一致性四件套
2. 风格锁块（Style Lock）
3. 角色设定图（三视图 / 表情表 / 服装表 / 角色卡）
4. 场景设定图（Location Sheet）
5. 关键帧（首帧）出图
6. 图生图编辑规则
7. 提示词格式与禁忌
8. 出图验收清单

---

## 1. 一致性四件套

跨图跨段不跑偏，靠这四样，缺一必飘：

| 件 | 内容 | 用在哪 |
|---|---|---|
| **① 身份块** | 脸型 + 眼色 + 肤色 + 发型发色 + 体型 + 服装逐件 + 显著特征 | 每张图、每段视频都重复 |
| **② 风格锁块** | 画风 + 线稿 + 上色方式 + 色板 hex + 光比 | 每张图、每段视频都重复 |
| **③ 参考图槽位** | 哪张图负责什么（脸 / 服装 / 场景 / 道具） | 提示词里逐条标注角色 |
| **④ 色板** | 3–5 个 hex 值，所有画面只用这几个色 | 交给用户核对"是不是这个调" |

**身份块英文模板（复制改数字）：**

```text
Identity: Chinese woman, 32, oval face with a soft jawline, deep brown almond eyes, pale cool-toned skin with faint freckles across the nose bridge, shoulder-length straight black hair parted in the middle, slim build, five foot six, wearing a cream high-neck ribbed knit sweater, dark charcoal straight trousers, thin silver bracelet on the right wrist, a two-centimeter pale scar on the back of the right hand.
```

**风格锁块英文模板：**

```text
Style lock: photorealistic live-action cinematography, 35mm film grain, soft halation on practicals, gentle vignette, cold blue-gray shadows (#1B2430, #2E3B47), desaturated cool skin (#C9B8AE), one warm amber practical accent (#D08B3E) never exceeding 10% of frame, hard single-source lighting, approximately 70% of the frame unlit.
```

---

## 2. 风格锁块：必须先定死

用户说"我要那个感觉"时，你就用下面六个维度逼出可执行参数，然后**锁死，全片不再改**。

| 维度 | 选项 | 示例 |
|---|---|---|
| 介质 | 真人实拍 / 二次元 / 3D / 定格动画 / 水墨 | `photorealistic live-action` |
| 质感 | 胶片颗粒 / 数字干净 / 手持纪实 | `35mm film grain, soft halation` |
| 线稿 | 无 / 细线 / 粗线（二次元必填） | `clean thin line art, no sketch lines` |
| 上色 | 写实光比 / 平涂赛璐璐 / 厚涂 | `flat cel shading, two-tone shadow` |
| 色板 | 3–5 个 hex | 见上 |
| 光比 | 高反差 / 柔光 / 单一光源 / 混合 | `single hard source, 70% unlit` |

**漫剧/二次元的风格锁额外三句（必写）：**

```text
Style lock: 2D cel-shaded animation, clean consistent line weight, flat color fills with one hard shadow tone, no photorealistic skin texture, no 3D render look, large expressive eyes with single specular highlight, background painted in the same limited palette.
```

---

## 3. 角色设定图

三种规格，按需要选。**默认先出三视图**（视频要跨镜锁脸，三视图最管用）。

### 3.1 三视图（正面 / 四分之三 / 背面）

```text
Create a character model sheet on a clean white background, flat even lighting with no cast shadows, thin #CCCCCC horizontal height reference lines across the full width at head, shoulder, waist, knee and foot level.
Subject: {角色身份块全文} — shown in three views left to right: front view facing camera, three-quarter view turned 75 degrees right, back view facing away.
Important details: identical proportions and vertical alignment across all three views, feet on the same baseline, arms relaxed at the sides for a clear silhouette, small color swatch circles (#1B2430, #C9B8AE, #D08B3E) connected by thin #999999 leader lines to the matching material on the front view, consistent clothing folds and seam lines across every angle.
Use case: pre-production model sheet for animation and 3D hand-off.
Constraints: no background elements, no props in hands, neutral standing pose only, the same character in all three views with identical outfit and proportions, no drop shadows, no gradient background.
```

参数建议：`16:9` 或 `3:2`，高保真档（要出可读色号与字）。

### 3.2 表情表（6–9 格）

```text
Create a 3x3 expression sheet on a white background with thin #DDDDDD dividers, each cell one head-and-shoulders portrait.
Subject: {角色身份块} — same head angle three-quarter left, same hairstyle, same lighting in every cell, {风格锁块}.
Important details:
Cell 1 NEUTRAL — relaxed brow, closed mouth, calm eyes.
Cell 2 FEAR — breath held, pupils contracted, lips parted slightly.
Cell 3 ANGER — jaw locked, nostrils flared, eyes narrowed.
Cell 4 SHAME — gaze dropped, shoulders drawn in, one hand covering the side of the face.
Cell 5 RESOLVE — one full exhale, shoulders dropped, gaze locked forward.
Cell 6 COLLAPSE — eyes glistening, mouth downturned, head lowered a few degrees.
Cell 7 SURPRISE — wide eyes, raised brows, mouth open.
Cell 8 DISGUST — wrinkled nose, upper lip raised.
Cell 9 EXHAUSTION — eyelids heavy, jaw slack.
Labels in small condensed sans-serif beneath each cell, #555555 text.
Constraints: identical identity across all nine cells, no change in hair or accessories, fixed head angle, no hand gestures except the specified one, labels legible.
```

**为什么有用**：情绪表定完，视频段的"情绪线索"就有图可对，写提示词时可以直接说 `same face as the FEAR panel`。

### 3.3 服装表（同人同姿态，只换衣服）

```text
Create a {2x3} grid outfit sheet on a light neutral background (#F0F0F0), thin white gaps between cells, soft even front lighting in every cell.
Subject: {角色身份块} — same pose (relaxed standing, hands at sides) in every cell, only the outfit changes.
Important details:
Cell 1 居家 — oversized washed cotton tee, soft shorts, barefoot.
Cell 2 通勤 — cream knit sweater, charcoal straight trousers, leather loafers.
Cell 3 雨夜 — dark hooded trench, wet shoulders, sneakers.
Cell 4 正式 — black tailored suit, no tie, silver bracelet visible.
Cell 5 病中 — pale blue hospital gown, bare feet, hair loose.
Cell 6 结局 — the same cream sweater, now visibly worn and stained.
Outfit name in small bold sans-serif centered below each cell, #333333 text.
Constraints: identical face, hair, skin tone and body proportions across every cell; no background scenery; no overlapping garments; uniform grid.
```

### 3.4 角色卡（一页给全组看）

```text
Create a professional character reference card on a white background, divided into clear sections by thin #CCCCCC separators.
Subject: {角色身份块}, {风格锁块}.
Layout: left 40% full-body front standing pose, arms slightly away from the body, feet visible; upper right portrait bust at three-quarter angle showing {面部特征}; mid right {3} signature items laid in a row — {手机}, {银镯}, {钥匙} — each drawn at consistent scale and labeled; lower right a horizontal strip of {4} color swatches ({#hex1}, {#hex2}, {#hex3}, {#hex4}) with hex codes beneath; bottom strip a single line of clean sans-serif text: "NAME {角色名} | AGE {年龄} | HEIGHT {身高}".
Constraints: one unified art style across all sections, items must match what the character carries in the full-body view, legible text, no decorative frames.
```

---

## 4. 场景设定图（Location Sheet）

视频段之间最容易跳的就是场景。**一场戏先出一张场景图，作为所有段的空间参考。**

```text
Create a location reference sheet for {场景名} on a white background with thin #CCCCCC dividers.
Panels: top — one wide establishing view of the space at {时间}, {风格锁块}; bottom left — one detail of the surface where the action happens ({门锁 / 桌面 / 台阶}); bottom right — one reverse angle showing the opposing wall and the light source position.
Important details: same architecture, same props in the same positions, same light direction in all three panels; the light source is visible in frame and identifiable; note the exact palette ({#hex}).
Constraints: no people, no text overlays, no camera-brand watermark, consistent geometry across panels.
```

**必写进场景图的三件信息**：光从哪来、出口在哪、什么挡住了视线。这三样决定了后面所有分镜可不可读。

---

## 5. 关键帧（首帧）出图

视频段的**首帧**是最重要的资产。它同时干了三件事：锁身份、锁光、锁构图。

**关键帧出图骨架：**

```text
[景别 + 焦段]  Low angle medium close-up, 50mm.
[锚点主体 + 状态]  Her right hand frozen on a fresh brass scratch around the door lock, fingertip mid-scrape.
[三层景深]  Foreground: the door frame edge, soft and dark, framing the shot. Midground: her hand and the lock, tack sharp. Background: the dim hallway, one cold tube light blooming, defocused.
[静帧中的运动线索]  A thin smear of fresh brass dust on the lock plate; the door slightly ajar with light spilling through a 3mm gap.
[光与色板]  Single cold fluorescent tube as key from upper frame-right, hard shadow under the knuckles; warm amber spill from inside the flat as rim; palette {#hex}.
[质感]  Fine 35mm grain heaviest in shadow, soft halation on the tube light, crushed blacks.
[人物状态]  Face out of frame — only the hand and the wrist.
Constraints: no extra hands, no text, no watermark.
```

**静帧表达运动，靠六个冻结线索之一**（详见 `05-storyboard-keyframes.md`）：
方向性动态模糊 / 局部冻结模糊 / 全幅拖影 / 姿态与轨迹向量 / 主体实·环境虚 / 刻意的绝对静止。

---

## 6. 图生图编辑规则

**已经 80% 对了就改，不要重抽。** 重抽等于把 80% 也赌掉。

```text
Change: {只改一件具体的事}
Preserve: {脸 / 姿态 / 光 / 构图 / 服装 / 几何}
Constraints: {不要新增物件、不要漂移}
```

示例：

```text
Change: raise the key light so it comes from the top-left at 45 degrees instead of straight on.
Preserve: her face, the exact hand position on the lock, the door geometry, the cold blue-gray palette, the film grain.
Constraints: no new objects in frame, no change to wardrobe, keep the background defocused.
```

规则：
- **一次只改一件事**。改完看，再改下一件。
- 改脸最容易连带改光，改光最容易连带改脸。两件事不要同时改。
- 编辑用的提示词比生成用的短，只要说清"改什么、保什么"。

### 6.1 用户已经有素材：三种用法，别混

拿到用户给的图（照片、剧照、手绘、AI 图）时，先定性它当什么用。**这三种用法写法完全不同：**

| 用法 | 适用 | 提示词写法 | 常见错 |
|---|---|---|---|
| **① 首帧**（image-to-video 起点） | 已有构图、要它动起来 | 只写运动、镜头、光的变化，**不重描已见元素**；开头写 `Maintain the subject and lighting from the first frame exactly.` | 重描画面 → 身份漂移 |
| **② 参考食材**（锁身份/场景/道具） | 图不是最终画面，只要它的"人"或"景" | 逐张标注角色：`The character from reference_1 stands in the location from reference_2, holding the object from reference_3.` 每张后跟身份块文字 | 只丢图不说话 → 模型自己猜 |
| **③ 风格参考**（只要调子） | 只要那股味道，不要里面的人 | 把风格拆成介质/质感/色板/光比四项写成 `Style lock`，**不引用原图**（引用会把原图的人也带进来） | 直接引用 → 换不掉原人物 |

**拿到素材先问一句**：「这张是当第一帧，还是当参考？」一句话就能定，猜错要重做整段。

---

## 7. 提示词格式与禁忌

**输出格式（图像）：**

```text
Model: {图像模型名}
Ratio: {16:9 | 9:16 | 3:4 | 1:1}
用途: {设定图 / 场景图 / 关键帧 / 表情表}

Prompt:
<正文，英文，可直接粘贴>

Notes:
- <你替他推断的假设，逐条列出>
```

**七条铁律：**

1. **以动词开头**：Create / Design / Generate / Transform / Edit。先给意图，再给细节。
2. **正向陈述**：写你要的，不写你不要的。`empty street` 优于 `street with no cars`。
3. **文字加引号**：`"NAME LIN WAN"`，并指定字重与位置。
4. **颜色给 hex**：`#1B2430` 优于 `deep blue`。
5. **给语境**：`for a vertical short-drama key visual` 会自行推出一整套合理决策。
6. **比例与分辨率不写进正文**：走参数行（`Ratio: 9:16`），正文里只描述画面。
7. **导演名字最多一个**，且必须翻成具体参数；并列三个名字 = 一锅粥。

---

## 8. 出图验收清单

一张图交付前，逐条过：

- [ ] 脸和三视图一致吗？换个角度看还是同一个人吗？
- [ ] 服装、饰品、疤痕这些"显著特征"都在吗？
- [ ] 光的方向和图里说的一致吗？（主光从哪来，阴影落哪儿）
- [ ] 色板在 3–5 色之内吗？有没有偷偷混进暖黄或高饱和？
- [ ] 景别和焦段看得出来吗？（广角有畸变吗，长焦有压缩吗）
- [ ] 三层景深都有活吗？（前景挡、中景实、背景托）
- [ ] 画面里有没有多余的手、多余的人、多余的字？
- [ ] 作为视频首帧，它能接住下一段的运动吗？
- [ ] 用户能一眼说出"这是谁、在哪、在想什么"吗？

有两条不过，重画；一条不过，改。

---

*部分模板改写自 Serge Shima《visual-skills》image/references（CC BY 4.0），已按视频前置资产需求重排，并加入风格锁块、场景图、关键帧三层景深规则。*
