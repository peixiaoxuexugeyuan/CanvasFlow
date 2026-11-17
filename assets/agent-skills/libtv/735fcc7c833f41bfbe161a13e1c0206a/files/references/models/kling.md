# 模型 · Kling 4.0（快手可灵）

> **一句话定位**：物理真实感 + 角色一致性最强；4.0 起单次 3–30 秒原生、最多 10 个关键帧锚点、15 路混合参考、原生 4K 10-bit HDR 与立体声口音级口型。\
> 短剧、漫剧、有对白的长镜头段落优先选它。

---

## 1. 版本与容量

版本关键能力提示词长度1.6极简，别多说极短2.1 Pro1080p/30fps，动态笔刷，尾帧控制短2.5 Turbo Pro最多 3–4 个元素50–80 词2.6 Pro5–7 个元素，运动控制，元素绑定50–80 词3.0一次最多 6 镜、15s、原生音频与口型、4K/60fps每镜 30–60 词3.0 Turbo便宜档，口型更好，3–15s，上限 1080p中3.0 Omni引用与编辑旗舰，3–15s，4K 进出，声音绑定中**4.0单次 3–30s 原生直出、最多 10 关键帧、15 路混合参考、原生 4K 10-bit HDR（含 21:9）、双声道立体声口型按时间块写，上限 8000 token**4.0 Flash轻量探路档，3–20s，720p SDR，成本低、出片快中

**选型**：

- **要一条 15–30 秒连续叙事 / 要钉死走位 / 要 4K HDR** → **4.0 完整版**。
- **试钩子、跑动态分镜草稿、批量出社媒版本** → **4.0 Flash**（跑量后再升级，算力省一半以上）。
- **要段内 5–6 镜快切、不需要 30 秒** → 3.0 更便宜。
- **单镜无对白、只要便宜** → 老版本。

> 4.0 与 Flash 的**二八协同**是本技能推荐的长片打法：Flash 出草稿定节奏与提示词，完整版只渲染最终定稿。

---

## 2. Kling 4.0：五层结构 + 时间块

```text
Scene  →  Characters  →  Action  →  Camera  →  Audio
```

**角色标签必须前置**，先声明身份，后面只用标签：

```text
[Character A: Heroine — 32, oval face, deep brown eyes, shoulder-length straight black hair, cream high-neck knit sweater, thin silver bracelet on the right wrist]
[Character B: Landlord — mid-50s, round face, short gray hair, dark gray jacket, key ring at his waist]

Master intent: <这一段的戏剧意图，一句话>

Shot 1 (0.0–6.0s). Close-up, 85mm, locked static frame. <动作与细节>。
Shot 2 (6.0–14.0s). Medium shot, 35mm, slow lateral tracking. <...>。
Shot 3 (14.0–22.0s). OTS two-shot, 50mm, static. <...>。
Shot 4 (22.0–30.0s). ECU, 100mm macro, slow push-in. <...>。

Camera. <主导语法 + 焦段清单>。
Lighting. <主光方向 + 光质 + 轮廓光>。
Audio. <环境 + 事件 + 是否配乐>。
```

**多镜不塌的两条**（3.0 时代规则，4.0 仍适用）：每镜的景别或机位必须**不同**；相邻两镜不能同时共享景别与角度（否则合并成一镜）。

**4.0 的差别**：时间轴拉到 30 秒后，光靠 `Shot N` 分块已经压不住中间 20 多秒的走位漂移。**必须同时启用 §3 的关键帧锚点**，把每一拍钉在具体画面上。

---

## 3. 关键帧锚点协议（4.0 核心新能力）

单次最多 **10 张关键帧**。30 秒 ÷ 10 帧 ≈ **每 3 秒一个锚点**，正好对上本技能的"段内节拍"粒度。

**写法**：关键帧编号、时间点、该帧必须看到的画面，三者写在同一行，再用时间块描述帧与帧之间怎么走。

```text
Keyframe 1 (0.0s)   — extreme close-up: fingers closing the suitcase latch.
Keyframe 4 (9.0s)   — medium shot: platform, the train door slides open.
Keyframe 7 (18.0s)  — wide: she steps off, wind lifts the coat hem.
Keyframe 10 (30.0s) — 21:9 vista: shoreline at sunset, she stops at the water line.
```

**三条纪律**：

1. **锚点要干活，不要重复**。相邻两帧的景别、主体状态或空间必须已经变化；两帧一样等于浪费一个锚点。
2. **关键帧用图，不靠文字描述替代**。10 张锚点最好是同一风格锁下出的静态帧（`04-image-chain.md`），文字只负责告诉模型"这两帧之间发生了什么"。
3. **帧与帧之间只写变化量**：谁移动、移到哪里、光怎么变、道具状态如何过渡。不要重描已经印在关键帧上的长相。

---

## 4. 15 路混合参考与保存元素

单次可组合 **最多 10 张图 + 5 段视频**，另可叠加 **最多 7 个已保存主体（Saved Elements）与音色样本**。

参考类型用来锁什么提示词里怎么写图片（≤10）角色长相、服装、场景、风格、关键帧画面`<Picture N>` / `[Character A]` 引用视频（≤5）运镜、动作、剪辑节奏、整体影调`follow the camera grammar of reference video 1`保存主体（≤7）跨集不换脸的角色与道具`[Character A]`（已在元素库绑定）音色样本跨集不串音的嗓音写进角色标签：`[Character A, low even voice]`

**长片 / 短剧必用两张牌**：角色进 **Saved Elements**、嗓音进 **音色样本**。这是"第 1 集到第 30 集不换脸、不串音"的唯一可靠做法，比每次重传三视图稳。

**代价**：启用元素会带来轻微画质下降。一次性镜头用文本标签就够，只有要跨段复用的角色才进元素库。

---

## 5. 台词协议 P1–P5（口型不准就照这个改）

规则做法反例**P1 命名**每个角色唯一标签 `[Character A]`"男人说…然后他说…"**P2 视觉锚定**台词前绑一个唯一动作只写台词不绑动作 → 口型漂**P3 声音描述写进标签**`[Character A, low steady voice]: "..."[男人]` → 得到通用嗓音**P4 句间过渡**两句之间加 `Immediately,` / `Without looking up,`两条连续标签 → 叠音**P5 指定口音（4.0 新增）**`[Character A, British English accent, low steady voice]`不写口音 → 得到默认音色

4.0 支持在提示词里指定具体口音（英式、澳式、粤语等）并严密咬合口型；语种覆盖中、英、日、韩、西、葡、德、法、印地语。

完整示例：

```text
Shot 3 (6.0–9.0s). Profile close-up on Character A. He slides a photo across the table.
[Character A, low even voice]: "You were there."
Shot 4 (9.0–12.0s). Reverse — close-up on Character B. She does not look up.
Immediately, [Character B, fragile broken voice]: "I didn't see anything."
```

> 4.0 的音频默认生成、与画面同出。要做**纯画面无音**的段落，只能后期抽掉音轨，不要指望"不写 Audio 段"就没有声音。

---

## 6. 负向字段（Kling 独有）

**字段自动理解为"排除"，所以不要写 no。**

- ❌ `no robots` → ✅ `robots`
- ❌ `no blurry faces, no distorted hands` → ✅ `blurry faces, distorted hands, melted features`

常用清单：

```text
low resolution, blurry, distorted hands, extra fingers, melted face, watermark, subtitles, logo, text overlay, jitter, shaking camera, deformed
```

**列表要短**。堆太长会同时压掉运动与细节。

---

## 7. 图生视频（短、只写动）

20–40 词，只写运动 + 一句光的变化。

```text
Preserve identity, wardrobe and the door geometry exactly. Slow push-in, 50mm. Her fingertip lifts off the lock plate, her eyes shift left, one strand of hair falls across her forehead. Cold light widens across her hand.
```

4.0 的写法：`Preserve identity and lighting exactly.` 开头，然后只写镜头与运动；若同时挂了关键帧锚点，正文只描述锚点之间的过渡。

---

## 8. 4.0 的四项硬规格（写提示词时会用到）

规格值对写法的约束时长3–30s 单次；可多轮延展至 \~2 分钟本技能规定**单段 ≥5s**；要 30s 以上先按 §3 锚点切段，再用延展拼分辨率720p / 1080p / 原生 4K，10-bit HDR4K 只用于定稿；草稿阶段用 Flash 720p画幅16:9 / 9:16 / 1:1 / 21:921:9 只适合横屏影院感段落，竖屏短剧不要用文本容量提示词上限 8000 token30s 长镜可以写满，但**每多一个 token 都要是新的画面信息**，不要复述

**4.0 还解决了两件老问题**：

- **运动文字稳态**：引号标注的文字（招牌、包装、字幕）在推拉环绕中不再融成乱码。要文字就**加引号并写全**。
- **高速运动稳态**：打戏连招、车队跟拍、悬崖环绕的连贯性与清晰度明显提升，允许写"快"了——但本技能的运镜纪律仍要求**一个镜头只主导一种运动**。

---

## 9. 失败模式

现象修法定镜却在飘写 `locked static frame` / `camera fixed, no movement`提示词太长，画面融化压到 50–80 词，元素降到 3–7 个跨次换脸角色进 Saved Elements（3–4 张多角度参考），或一次生成内只用文本标签负向无效去掉 "no"，只写东西本身4.0 长镜中段走位漂上关键帧锚点，每 \~3s 一帧，帧间只写变化量30 秒塞了 8 个事件一段只完成一个功能；超出的拆段，用延展接口型漂P2 绑动作 + P4 加过渡词嗓音不对P3 把声音描述写进标签；P5 指定口音开了元素后画质下降只在必要时开；一次性镜头用文本标签4K 出片太慢太贵草稿走 Flash 720p，定稿再上 4.0 4K画面文字变乱码用引号写全文本，别用缩写

---

## 10. 12 秒审讯戏（短段，3.0 / 4.0 通用）

```text
[Character A: Investigator — late 30s, navy raincoat, tired blue eyes, three-day stubble]
[Character B: Witness — early 20s, oversized hoodie, hands wrapped around a paper cup, eyes red from crying]

Master intent: a 12-second interrogation in a fluorescent-lit precinct break room at 2am. The investigator holds back, the witness breaks.

Shot 1 (0-3s). Two-shot, eye level, 35mm. Character A sits across from Character B. Static frame.
Shot 2 (3-6s). OTS over Character A's shoulder. Character B's hands tighten on the paper cup.
Shot 3 (6-9s). Profile close-up on Character A. He slides a photo across the table.
[Character A, low even voice]: "You were there."
Shot 4 (9-12s). Reverse — close-up on Character B. She does not look up.
Immediately, [Character B, fragile broken voice]: "I didn't see anything."

Camera. Locked frames, no movement except the slide of the photo. Sony FX6 feel.
Lighting. Cold overhead fluorescent, slight flicker. Pale skin, hard shadows under the eyes.
Audio. Distant police radio chatter, the buzz of the fluorescent tube, a vending machine humming in the corridor. No music.

Negative field. blurry, distorted hands, extra fingers, melted face, watermark, subtitles, jitter, dialogue overlap.
```

---

## 11. 30 秒关键帧长镜（4.0 专属写法）

演示 4.0 的三件事：**10 个锚点、时间块、21:9 收幅**。

```text
[Character A: Commuter — 29, navy wool coat, damp shoulder-length hair, canvas weekender bag in the left hand]

Master intent: a 30-second continuous take, from a cramped apartment to a shoreline at sunset. The room shrinks behind her; the world opens in front of her.

Keyframe 1 (0.0s)   — ECU: fingers pressing the suitcase latch shut, dust in a low window light.
Keyframe 3 (6.0s)   — medium: she pulls the door closed behind her, hallway bulbs flickering.
Keyframe 5 (12.0s)  — wide: platform, the train door slides open, steam crossing the frame.
Keyframe 7 (18.0s)  — OTS: seated by the window, city lights streaking across her reflection.
Keyframe 9 (24.0s)  — wide: she steps off onto the shore path, wind lifting the coat hem.
Keyframe 10 (30.0s) — 21:9 vista: she stops at the water line, horizon level, sun already half down.

Camera. One continuous take, 35mm, constant gentle push-in; amplitude grows from small to large as the space opens.
Lighting. Starts with a single hard window shaft in the flat; ends in low warm backlight with a soft rim on the coat.
Audio. Apartment room tone, a latch click, a subway rumble swelling under the platform, then wind and distant surf. No music.
```

**三条自检**：锚点之间是否只写变化量；相邻锚点景别是否已变；末帧是否落在 21:9 且情绪收得住。

---

## 12. 接进本技能的分段系统

```bash
# 保守切：按 15s 一段（脚本内置 kling3 预设的原值）
python scripts/plan_timeline.py --total 120 --model kling3 --aspect 9:16

# 吃满 4.0：沿用 kling3 的 6 镜上限，把单次时长提到 30s
python scripts/plan_timeline.py --total 300 --model kling3 --cap 30 --aspect 9:16
```

> `plan_timeline.py` 的模型预设里只有 `kling3`（cap 15s / 6 镜），**没有 kling4**。要用 4.0 的 30 秒，用 `--cap 30` 覆盖即可，不要改脚本；报表里"目标模型"一栏仍会打印脚本内置的旧描述文字，属正常现象。\
> 5 分钟：30s 档是 10 段，15s 档是 20 段。段数越少接缝越少，4.0 优先。

---

*Kling 章节改编自 Serge Shima《visual-skills》video/references/kling.md（CC BY 4.0），已按本技能分段体系统一并补中文说明；4.0 规格按快手可灵 2026-10 公开资料整理。*