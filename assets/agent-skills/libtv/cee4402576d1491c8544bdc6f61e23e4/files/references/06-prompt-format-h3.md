# 06 · 提示词格式规范

## 总则

每段一份独立提示词文件。**正文全英文**。六个固定段落，顺序不可调换：

```
subject_definitions
summary
retention_analysis
detailed_description
overall_soundscape
non_diegetic_music
```

单段片（≤15 秒）也用同一套格式，只是文件头里 `SEGMENT: 1 OF 1`。

---

## 一、文件头（每段必备）

逐条一行，整段不换行。块首块尾用 `====` 分隔。

```
==== BRAND PROMO / SEGMENT 2 OF 4 ====
MODE: I2VA, first frame is the exported out-point frame of segment 1
DURATION: 12.0 s / 360 frames @ 30 fps
GLOBAL TIMELINE: 00:11.5 – 00:23.5 of 00:47.0 total
SEGMENT ROLE: user intent resolving into product mechanism (beats 4–6)
IN-POINT STATE: continuation of segment 1 final frame — same camera height, same soft window light from screen right, the fingertip still 2 cm above the button
OUT-POINT STATE: at 00:12.0 the interface panel is fully expanded, the cursor rests still at the lower right of the panel, camera settled, frame stable for the last 0.6 seconds
LINK IN: L1 Frame Chain from S1
LINK OUT: L2 Match Cut to S3, outgoing motion exits frame right at constant gentle speed
ASPECT: 16:9
LANGUAGE: on-screen copy in English; no spoken narration
AUDIO NOTE: native audio on, generate_audio=true, instrumental only, no vocals, no lyrics
CAMERA RULE: every camera move must be slow, steady, gradual, at constant gentle speed; never use fast, rapid, whip, spin, snap zoom, or quick rotation
LIVING-SCENE RULE: constant believable micro-motion in every shot — finger pressure, breathing shoulders, cursor pulse, steam drift, fabric sway, light flicker; never a frozen frame
FILM STYLE: photorealistic live-action, 35mm film grain, soft halation, gentle vignette, warm color science, shallow depth of field on product surfaces
====
```

### 字段填写规则

| 字段 | 规则 |
|---|---|
| MODE | `T2VA` 纯文本 / `I2VA` 首帧 / `FL2VA` 首末帧 / `L2VA` 只给末帧 / `Ref2VA` 全参考 |
| DURATION | 秒数 + 帧数，两个都给 |
| GLOBAL TIMELINE | `mm:ss – mm:ss of mm:ss total`，全局时间必须连续无缝 |
| SEGMENT ROLE | 这一段承担哪几个节拍，一句话 |
| IN-POINT STATE | 首帧的机位、光位、主体位置、动作状态。续接时写明"承接上一段末帧" |
| OUT-POINT STATE | 末帧状态，格式同 IN-POINT，另注明"最后 X 秒画面稳定" |
| LINK IN / OUT | `L1`–`L5` + 一句话，见 `05-segmentation-and-chaining.md` |
| CAMERA RULE | 防虚影三律第一条，逐字不改 |
| LIVING-SCENE RULE | 防虚影三律第二条，逐字不改 |
| FILM STYLE | 质感块，全片一致，不逐段改 |

### 两套时间坐标，不要混用

| 位置 | 坐标 | 起点 | 示例 |
|---|---|---|---|
| 文件头 `GLOBAL TIMELINE` | **全局**时间 | 00:00.0 = 全片第一帧 | `00:11.5 – 00:23.5 of 00:47.0` |
| `detailed_description` 每镜的时间戳 | **段内相对**时间 | 00:00.0 = 本段第一帧 | `[00:04.0–00:08.0 / beat 5 / ...]` |

镜头时间戳**一律从 00:00.0 起算**，到本段 DURATION 结束，绝不写全局时间。全局位置只出现在文件头的 `GLOBAL TIMELINE` 与 `SEGMENT` 两个字段里。混用会直接导致模型按错误时长生成。

---

## 二、六段写法

### 1. subject_definitions

定义本段出现的所有主体。一条一行，编号。**只定义，不描述动作。**

```
==== SUBJECT_DEFINITIONS ====
[1] BRAND LOGO: the supplied vector file logo_main.svg, rendered flat, exact proportions, never redrawn or approximated.
[2] PRODUCT UI: the supplied screenshot ui_01.png, a light-mode dashboard with a left rail, three summary cards, and one wide chart panel; text is rendered as supplied, never re-typed.
[3] CURSOR: a small rounded pointer, 24 px, dark charcoal with a thin white outline.
[4] HAND: one right hand of an adult, short clean nails, no jewellery, neutral skin tone.
[5] DESK SURFACE: matte warm-grey laminate, fine even grain, no reflections beyond a soft sheen.
[6] AMBIENT PROPS: a ceramic mug with visible steam, a closed notebook, a pen at rest.
```

要点：
- 身份型主体（LOGO / UI / 包装 / 产品）必须写"使用所提供文件、不得重绘"
- 人物写可复现的物理特征，不写"年轻专业女性"这类模糊标签
- 数量控制在 4–8 条；超过 8 条说明这一段想讲的太多

### 2. summary

一整段一行。说清这一段讲什么、给谁看、落点是什么。

```
==== SUMMARY ====
A product manager opens a light-mode analytics dashboard on a warm desk and presses one button; the interface expands from a single card into a full working panel while a mug of tea steams beside it, ending with the panel complete and the cursor at rest, communicating that a full report is produced from one click in under three seconds.
```

写不好 summary 通常是因为节拍表里没有"证明点"。回 STEP 5 补齐。

### 3. retention_analysis

观众为什么不会划走。这一段是**信息结构分析**，不是形容词堆砌。

```
==== RETENTION_ANALYSIS ====
Hook (0.0–1.2 s): the frame opens already mid-action — a finger descending toward a single button — so there is no establishing shot to skip past.
Information gap (1.2–4.0 s): the panel is only half visible at frame edge; the viewer waits to see what it contains.
Payoff (4.0–9.0 s): the panel expands fully and resolves into a readable chart, closing the gap opened at 1.2 s.
Proof (9.0–11.4 s): the numbers on the chart come from the supplied screenshot, so the claim is visually verified rather than asserted.
Brake (11.4–12.0 s): camera settles and the cursor stops, giving 0.6 s of readable stillness before the next segment.
Risk: if the panel opens faster than 2.5 s the payoff feels cheap; if slower than 4 s the gap stops being a promise and becomes a wait.
```

要点：必须写出**具体秒数**和**具体风险**。写不出秒数说明节拍没排。

### 4. detailed_description

逐镜描述。**每镜一整段一行**，行首带时间戳与运动意图标签。

```
==== DETAILED_DESCRIPTION ====
[00:00.0–00:03.9 / beat 4 / setup → commitment] The shot opens on a tight macro of the supplied dashboard button, the fingertip 2 cm above it, soft window light from screen right raking across the matte surface; at 00:00.6 the finger descends slowly and steadily, contacting the surface at 00:01.4 with a barely visible compression of the fingertip, and the button shifts to its pressed state; the camera begins a slow steady pull-back from 00:02.0, revealing the edge of the panel entering from frame left.
[00:03.9–00:07.8 / beat 5 / commitment → impact] The pull-back continues at constant gentle speed until the panel occupies the right two thirds of frame; the left rail slides in from frame left with a soft edge shadow, three summary cards fade up in sequence 0.2 s apart, each landing with a small settle, and the cursor drifts from the button to the first card and rests there for 0.8 s; a thin column of steam from the ceramic mug crosses the lower left of frame throughout, drifting upward in a slow even curl.
[00:07.8–00:12.0 / beat 6 / impact → brake → settle] The wide chart panel expands from the card position to full width in one continuous 1.4 s move, its bars growing upward from the baseline in a slow stagger of 0.12 s per bar; the cursor moves to the lower right of the panel and stops; from 00:11.4 the camera holds completely still, the steam continues to drift, the cursor pulses once faintly at 00:11.7, and the frame remains stable through 00:12.0.
```

每镜必含：
- 时间戳 + 节拍号 + 运动意图
- 一个主动作（多动作拆镜）
- 光位与机位（供续接比对）
- 微动来源（蒸汽、呼吸、光标脉冲）
- 运镜速度词必须是 slow / steady / gradual / constant gentle

### 5. overall_soundscape

同期声与环境声。**这一段决定"真不真"。**

```
==== OVERALL_SOUNDSCAPE ====
Room tone is a quiet office at rest — a low HVAC hum, faint keyboard clicks from somewhere off-screen, no traffic, no voices; the mug's steam is silent, the button press produces one soft mechanical tick at 00:01.4, the panel expansion adds a smooth low whoosh rising from 00:07.8 and resolving at 00:09.2, and the cursor lands with a barely audible dry tap at 00:09.6; the ambient hum continues past the end of this segment without fading, so the next segment can start on the same bed.
```

要点：写**具体时间点的具体声音**，写"没有"什么（人声、车流），写跨段延续的声床。

### 6. non_diegetic_music

非叙事配乐。

```
==== NON_DIEGETIC_MUSIC ====
A minimal instrumental bed at a slow walking tempo, one warm analogue pad and a soft plucked synth on the beat, no drums, no vocals, no lyrics; the pad enters at 00:00.0 at low level, lifts by roughly 3 dB at 00:01.4 on the button press, opens slightly at 00:07.8 with the panel expansion, and holds level through 00:12.0 without resolving, so the phrase can continue in the next segment.
```

要点：写**乐器 / 速度 / 情绪 / 动态变化点 / 是否收束**。跨段时明确"不解决，留给下一段"。

---

## 三、排版硬规则

**不做手动断行。**

| 允许分行 | 禁止分行 |
|---|---|
| 字段名行（`MODE:` 一行） | 句子按列宽硬换 |
| 上传顺序清单条目（每条一行） | 把 `summary` 拆成多行 |
| `====` 分隔线 | 把一镜的 `detailed_description` 拆成多行 |
| — | 把 `CAMERA RULE` 等长规则拆成多行 |

一句话：**一个字段 / 一个标签 / 一段说明 = 一整行，写多长都不换行。**

---

## 四、常见扣分点

| 扣分点 | 表现 | 修法 |
|---|---|---|
| 运镜词违规 | 出现 `fast` `rapid` `whip` `spin` | 全换 slow / steady / gradual / constant gentle |
| 死画面 | 定镜里没有任何微动 | 补蒸汽、呼吸、光标脉冲、布料、水面 |
| 身份型主体被重绘 | "a logo that looks like..." | 改成"使用提供的 logo_main.svg，不得重绘" |
| 一镜多动作 | 一句话里"并且""同时" | 拆成两镜 |
| 时间戳不连续 | 上一镜到 3.9，下一镜从 4.2 开始 | 必须首尾相接 |
| 节拍号缺失 | 只有时间戳 | 每镜标 `/ beat N /` |
| 声音全无时间点 | "有轻音乐" | 写到秒 |
| 跨段没写延续 | 每段音乐独立收束 | 写"不解决，留给下一段" |
| 文字过多 | 一镜 20 字 | ≤12 字，停留 ≥1.2 秒 |
| 段落顺序错 | 把 music 写在 soundscape 前 | 六段顺序固定 |
| 用中文写正文 | 混入中文 | 正文全英文；中文只出现在给用户的说明里 |
| 两套时间坐标混用 | 镜头时间戳写了全局时间 | 镜头一律段内相对时间，从 00:00.0 起 |

---

## 五、单段（≤15 秒）与多段的差异

| 项 | 单段 | 多段 |
|---|---|---|
| MODE | T2VA 为主 | 后续段 I2VA / FL2VA |
| IN / OUT-POINT STATE | 可写"无（首帧由文本定义）" | 必写，且首尾互相对接 |
| LINK | 无 | 必写，每接缝一个 |
| GLOBAL TIMELINE | `00:00 – 00:15 of 00:15` | 每段区间不同 |
| 配乐收束 | 收束并落定 | 除末段外不收束 |
| 末镜 | LOGO + CTA + 定格 ≥1.5 秒 | 只有末段有 LOGO 落版；前段结尾不留 LOGO |

---

## 六、生成后自检

```bash
python scripts/validate_prompt.py prompts/S2_11.5-23.5.txt --total 47
```

检查项：六段标题齐全且顺序正确、文件头字段齐全、时间戳连续、运镜禁用词、微动关键词、时间戳格式、正文英文占比、段时长与总时长核算。
