# 08 · 故障字典与交付模板

> 提示词写完了但结果不对，99% 落在这张表里。**先查表，再改词。**
> 改之前先问一句：这是"提示词的问题"，还是"我根本没给模型那个信息"。

---

## 目录

1. 连续性检查清单（发稿前 16 项）
2. 故障字典：现象 → 原因 → 修法
3. 默认负向清单
4. 输出格式 A–G
5. 提示词审计格式（D 的完整版）

---

## 1. 连续性检查清单（发稿前 16 项）

- [ ] 同一角色跨镜（脸、身体、发型）一致
- [ ] 服装逐件点名且跨镜不变
- [ ] 场景逻辑一致（门在哪、窗在哪、光从哪来）
- [ ] 道具状态推进合理（划痕→铜屑→指纹；手机亮→裂→黑）
- [ ] 没有多余的角色进入画面
- [ ] 没有多余的字幕、logo、水印
- [ ] 年龄 / 体型 / 脸型没有漂移
- [ ] 没有物理不可能的手-物交互
- [ ] 没有含糊的运镜（"cinematic camera"）
- [ ] 没有含糊的光（"beautiful light"）
- [ ] 没有堆三个以上导演名字
- [ ] 没有自相矛盾的指令
- [ ] 色板有具体颜色（hex 或明确色名）
- [ ] 落点画面（最后一帧）明确写出
- [ ] 时长与段数对得上（Σ == 总长）
- [ ] 每镜三细节齐（环境压力 / 身体微动作 / 声音或母题）

缺一项，改完再发。

---

## 2. 故障字典：现象 → 原因 → 修法

### 2.1 结构类

| 现象 | 原因 | 修法 |
|---|---|---|
| 要多镜，出来是一条连续长镜 | 模型不理解切点 | 加显式切点标记：`Shot 1.` / `Cut to.` / `Camera cut to.`；并在开头写死 `This must be a clearly edited multi-shot sequence with visible hard cuts. Do not generate a single continuous take.` |
| 相邻两镜长得一样 | 两镜功能重复 | 换功能标签（Establish→Detail→Reaction），并强制换景别 |
| 节奏平，没有高潮 | 缺停顿、切长均匀 | 插一次静音 + 长度阶梯（长→短→更短→停顿→冲击） |
| 5 秒里塞了 8 个动作 | 时长不匹配动作量 | 减镜或加时长；动作多就给 10–15s |
| 段落之间接不上 | 没设计接法 | 用 L1–L5 明确接法（见 `06-longform-5min.md` §7） |

### 2.2 人物类

| 现象 | 原因 | 修法 |
|---|---|---|
| 每个镜头脸都变 | 缺身份锚块 / 每段没重复 | 每段开头贴完整六件套身份块 + 参考图标签 |
| 手融了、多手指 | 负向缺失 / 提示词太抽象 | Kling 负向字段写 `distorted hands, extra fingers`；其他模型正向写 `anatomically correct hands, clean finger separation` |
| 表情像 AI 塑料 | 堆了 `hyperrealistic 8k masterpiece` | 删掉；改用 `shot on 50mm, natural skin texture, motivated lighting, documentary feel` |
| 两个角色脸互相污染 | 两人共用一段描述 | 每人独立身份块 + 独立标签（`[Character A]` / `[Character B]`） |
| 说话口型对不上 | 台词前没有视觉锚 | 先给唯一动作（`He pulls the note out and reads aloud:`）再写台词 |
| 台词速度不正常 | 词太多 | 砍到 8 秒以内；长句拆两句 |

### 2.3 画面类

| 现象 | 原因 | 修法 |
|---|---|---|
| 光的方向每镜都变 | 没写死主光 | 每段重复：`key from top frame-right, hard; rim from frame-left` |
| 色板偷偷变暖 / 变艳 | 没有禁色 | 写具体色板 + `no warm yellow tones`（无负向字段则写 `cold blue-gray palette dominant`） |
| 镜头指令被忽略 | 镜头写在句中 | 提到开头：`Slow 50mm push-in. A man…` |
| 大远景人物脸糊 | 竖屏 + 景别太远 | 景别推近一档；竖屏默认中近景 |
| 画面很"干净"很塑料 | 缺质感信息 | 加颗粒、光晕、压死的黑、一处硬质高光 |
| 定镜却在漂 | 没锁机位 | `locked static frame` / `camera fixed, no movement` |

### 2.4 时长与拼接类

| 现象 | 原因 | 修法 |
|---|---|---|
| 总时长差 1–3 秒 | 没做帧级分配 | 用 `plan_timeline.py` 重算；余数用尾帧定格/变速吸收 |
| 出现 1–2 秒碎片段 | 强行凑整数 | 把余数摊到所有段（45+2 → 4×11.75） |
| 5 分钟像 20 个短片 | 没有幕结构 | 拆 5 幕，每幕 60 秒，幕尾留钩子 |
| 段与段之间跳色 | 没有统一风格锁 | 建 BIBLE，风格锁每段原样粘贴 |

### 2.5 模型专属

| 模型 | 专属坑 | 修法 |
|---|---|---|
| Seedance 1.x | 不支持负向 | 全部改正向陈述 |
| Seedance 2.0/2.5 | 人脸被强过滤 | 人脸戏走 1.5 Pro / Kling / Veo |
| Kling 1.x–2.x | 提示词太长会融 | 压到 50–80 词，元素 3–7 个 |
| Kling 负向字段 | 写了 `no X` 反而失效 | 直接写 `X` |
| Veo | 提示词太长会挑着听 | 压到 50–200 词，或改 JSON |
| H3 | 快速运动出虚影 | 运镜只写 slow / steady / gradual，禁 fast 类词 |

---

## 3. 默认负向清单

**只在支持独立负向字段的模型（Kling / Veo / H3 constraints）使用。** Seedance 全部改正向。

```text
blurry faces, distorted hands, extra fingers, melted features, deformed proportions, watermark, subtitles, logo, text overlay, jitter, camera shake, cartoon physics, duplicated limbs
```

中文版（写在 H3 的 `constraints` 段）：

```text
画面无字幕、无水印、无logo、无文字；不出现多余人物与肢体；手指数量与关节正确；面部不融化不变形；镜头无随机抖动
```

---

## 4. 输出格式 A–G

按需求选，不确定就用 **A**。

### A · 单条提示词

一次生成，一条可直接粘贴的稿子。开头给模型名 + 参数。

```text
Model: <模型名>  Duration: <秒>  Ratio: <画幅>
---
<英文提示词正文>
---
Notes: <你替他做的 3 个决定>
```

### B · 多段提示词

每段自带完整身份块 + 风格锁 + 声音 + 参数。标 `S01 / 20`。段间注明接法。

```text
S01 / 20 — 15s — Hook
接上段：—
段落点：ends on the gap of light widening under the door.
---
<提示词>
```

### C · 分镜表

| 时间 | 段 | 功能 | 动作 | 运镜 | 光 | 声音 | 情绪 |
|---|---|---|---|---|---|---|---|

每行是一张压缩场记卡（见 `02-dramaturgy.md` §11）。

### D · 提示词审计

给一份已有稿子，按 §5 的六段输出。

### E · 导演阐述

概念阶段的交付物，不是提示词。

```text
核心想法（一句话）｜情绪弧（三态）｜视觉母题（一个）｜节奏（快慢逻辑）
摄影语法（主导）｜光（主光源与方向）｜声音（质感）｜落点画面（最后一帧）
```

### F · 结构化（Veo JSON / 长片装配表）

- Veo：见 `references/models/veo.md` §6。
- 长片：见 `06-longform-5min.md` §11 的装配表格式。

### G · 全片装配表

长片/短剧/漫剧必须交，格式见 `06-longform-5min.md` §11 与 `07-short-drama-comic.md` §7。

---

## 5. 提示词审计格式（D 的完整版）

有人拿自己的稿子来问"帮我看看"，按这六段答，**顺序不许换**：

```text
① 已经对的
   <3 条以内，点具体动作，不要空夸>

② 会直接导致生成失败的
   <按严重度排；每条 = 现象 + 原因 + 具体改法>

③ 缺的导演信息
   <景别 / 焦段 / 光位 / 运镜理由 / 落点画面，缺哪条补哪条>

④ 连续性风险
   <跨段身份 / 道具状态 / 光的方向 / 空间轴线>

⑤ 模型不匹配的语法
   <用错模型的分段写法、负向写法、参数写法>

⑥ 改写版
   <完整可复制；末尾注明「改了 4 处：①…②…③…④…」>
```

**审计的三条纪律：**

1. 先跑 `python scripts/check_prompt.py 稿子.txt --total <秒> --model <模型>`，用客观清单开场。
2. **保留对方意图，只换执行**。他要慢，别给他快剪；他写了两句台词，别删成一句。
3. 改完再跑一次，把分数变化说出来（"61 → 94"）。数字比形容词有说服力。

---

*故障表部分条目改编自 Serge Shima《visual-skills》video/references/fixes-and-skeletons.md（CC BY 4.0）；已扩充模型专属坑、时长拼接坑与审计纪律。*
