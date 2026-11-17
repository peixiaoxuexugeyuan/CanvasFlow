# 03 · 提示词铁律：所有模型通用的 12 条

> 这一层是地基，模型专属语法是盖在上面的装修。**地基错了，装修救不回来。**
> 写完任何提示词，先过 §13 的三细节审计，再跑 `scripts/check_prompt.py`。

---

## 目录

1. 不可协商的一条
2. U1 通用骨架
3. U2 权重在开头
4. U3 演出来，别说出来
5. U4 自然语言 > 标签堆砌
6. U5 一镜一个主运镜
7. U6 精确的镜头语言
8. U7 身份锚块
9. U8 不要自相矛盾
10. U9 具体物理事实 > 抽象概念
11. U10 时长纪律（含分段表）
12. U11 落点画面法则
13. U12 三细节审计
14. 负向提示词策略
15. 提示词压缩顺序

---

## 1. 不可协商的一条

**细节即情绪。偷懒毁提示词。**

这是 AI 视频里最常被违反的一条，也是多段提示词失败的唯一主因：戏剧结构没问题，作者在某一镜偷了懒，一镜薄，整段被拖成糊。

每一个镜头，都必须凑齐三样具体物理细节：

1. **一条环境压力**：冷蓝冰箱光、沸水蒸汽、湿沥青、闪的荧光灯、滴水的龙头、空调风里起伏的窗帘。
2. **一个身体微动作**：牙关锁紧、指节在叉子上发白、嘴唇抿成线、硬吞咽、手指在门框上收紧。
3. **一个声音锚点或视觉母题**：2.3 秒时胃叫一声、暗手机屏里的倒影、同一扇窗上的雨、每次切之前荧光灯闪一下。

三条都不给 = 填充镜头，删掉或重写。**"建立镜头""过渡镜头""产品英雄镜头"没有豁免权**——这三种恰恰最先偷懒。

写了不渲染、且暴露偷懒的词：`cinematic`、`professional`、`high quality`、`masterpiece`、`stunning`、`epic`、`amazing`、`beautiful lighting`、`dynamic camera`、`intense moment`、`powerful scene`，以及「他很伤心/她很生气/他害怕」。

---

## 2. U1 通用骨架

每一段提示词都按这些层来搭，顺序大致如下：

```text
[主体 / 角色]
[动作 / 运动]
[场景 / 环境]
[运镜 / 景别 / 焦段]
[光 / 气氛]
[风格 / 情绪 / 色板]
[声音 / 音频]
[时长 / 画幅 / 分辨率]
[连续性规则]
[负向约束 —— 仅当模型支持独立负向字段]
```

**真实提交时不要保留方括号和中文标签**，把它写成连贯的英文句子或短段。模型专属骨架见 `references/models/`；多镜/带身份的正式稿优先用该文件的完整骨架。

---

## 3. U2 权重在开头

生成器对前 30–40% 的 token 注意力更高。

- **开头**：主体 + 动作 + 景别 + 焦段（画面骨架）。
- **中间**：环境、光、运镜。
- **结尾**：风格修饰、画质词、参数。

镜头指令被忽略时，把它提到最前面：「Slow 50mm push-in. A man opens the fridge.」胜过「A man opens a fridge. The camera slowly pushes in.」

---

## 4. U3 演出来，别说出来

模型渲染不了情绪，只渲染身体。

- ❌ `He is scared.`
- ✅ `His jaw locks. He stops breathing for one beat. His fingers curl against the doorframe.`

一个可用的换算表：

| 情绪 | 身体写法 |
|---|---|
| 恐惧 | 呼吸停一拍、喉结动、瞳孔收缩、指节发白 |
| 愤怒 | 鼻翼张、咬肌跳、下颌前推、拳头松开又握紧 |
| 羞耻 | 视线下移、后颈发热般缩肩、手遮住脸的一侧 |
| 内疚 | 回避对视、手指无意识抠桌沿、吞咽 |
| 决意 | 呼气一次到底、肩膀落下、视线锁定 |
| 崩溃 | 支撑腿软、手扶墙、呼吸碎 |

---

## 5. U4 自然语言 > 标签堆砌

视频模型不是图像模型。`masterpiece, 4k, cinematic, beautiful` 这类标签会失效。**用完整的电影句子写，像给一个真人摄影指导派活。**

---

## 6. U5 一镜一个主运镜

5 秒里堆三个运镜，出的是视觉混乱。**选一个主导运动**（推 / 移 / 跟 / 定），最多再叠一个微调（轻手持抖动、轻微变焦）。Nikon 甩镜的冲动留给真实现场。

---

## 7. U6 精确的镜头语言

### 焦段

| 焦段 | 效果 |
|---|---|
| 24mm | 广、沉浸、空间被夸张，压迫感 |
| 35mm | 自然的纪实感 |
| 50mm | 亲密的人眼视角 |
| 85mm | 肖像，背景压缩，脸好看 |
| 100mm macro | 质感、细节、微距插入 |
| anamorphic 40mm | 宽银幕电影感、横向光斑 |

### 景别

远景 / 全景 / 中景 / 中近 / 近景 / 特写 / 大特写 / 微距插入 / 过肩 / 主观 / 侧面 / 剪影 / 仰拍 / 俯拍 / 顶拍 / 斜角。

### 光

必须说清三件事：**光源是什么（key 从哪来）+ 光质（硬/柔）+ 色温**。
例：`cold fluorescent tube as key from top frame-right, hard quality, 4300K greenish spill; warm table lamp as rim from frame-left`。

### 色板

用具体颜色，不写"电影感配色"。
✅ `cold blue-gray shadows, desaturated skin, greenish fridge spill, black negative space, no warm yellow`
中文也照此写：`冷蓝灰阴影、皮肤降饱和、冰箱绿光溢出、黑位压死、无暖黄`。

---

## 8. U7 身份锚块

跨镜、跨段，身份必须锚在**每段开头**，不是只写一次。

**身份块六件套（缺一必飘）：**

```text
脸型 + 眼睛颜色 + 肤色 + 头发（颜色/长度/发型）+ 体型 + 服装（逐件）+ 显著特征（疤、痣、饰品、眼镜）
```

英文模板（直接抄）：

```text
Use @img1 as the identity reference and preserve the exact same person across the whole clip: oval face, deep brown eyes, pale cool-toned skin, shoulder-length straight black hair, slim build, wearing a cream high-neck knit sweater and dark straight trousers, thin silver bracelet on the right wrist, faint scar on the back of the right hand. No extra characters.
```

**规则：**

- 身份块必须紧跟引用标签（`@img1` / `@Image1` / 参考图槽位），图像 + 文字双信号才稳。
- 多段稿每一段原样重复身份块。模型跨次生成**没有记忆**，把它当成一个每天失忆的天才助理。
- 服装一旦写定，全片不许换（除非剧情换装，那也要写清在第几段换）。

---

## 9. U8 不要自相矛盾

模型服从最强信号，矛盾出瑕疵。

- ❌ 「静止的水面」+「流动的水」
- ❌ 「特写」+「宏大全景」
- ❌ 「安静的一刻」+「爆发动作」
- ❌ 「定镜」+「甩镜跟拍」

---

## 10. U9 具体物理事实 > 抽象概念

「孤独」渲染不出来。「一个男人独自坐着，肩膀塌下去，脸被手机蓝光照亮，桌上是空瓶」可以。

---

## 11. U10 时长纪律（本技能的核心约束）

**本技能支持的最短单次时长：5 秒。单次上限由模型决定。全片总长上限：5 分钟（300 秒）。**

| 目标总长 | 推荐拆法 | 段数 |
|---|---|---|
| 5s | 5s 一条过 | 1 |
| 10s | 10s 一条过 ／ 5+5 | 1–2 |
| 15s | 15s 一条过 ／ 10+5 ／ 5×3 | 1–3 |
| 20s | 10+10 ／ 15+5 | 2 |
| 30s | 30s 一条过（Seedance 2.5）／ 15+15 ／ 10×3 | 1–3 |
| 45s | 15×3 ／ 20+15+10 | 3 |
| 60s | 15×4 ／ 30+30 | 2–4 |
| 90s | 15×6 ／ 30×3 | 3–6 |
| 180s | 15×12 ／ 30×6（分 3 幕） | 6–12 |
| 300s | 15×20 ／ 30×10（分 5 幕） | 10–20 |

**不要硬塞**：单次时长有限，长片靠分段在剪辑里接起来。用 `scripts/plan_timeline.py` 自动算，它保证 Σ段时长 == 总时长（帧级零误差），且每段落在 5/10/15/20/30/45/60 的标准档上。

单段内的镜数上限：

| 模型 | 单次上限 | 单次最多镜数 |
|---|---|---|
| Seedance 2.5 | 30s | 5 |
| Seedance 1.x–2.0 | 5–10s | 5（建议 2–3） |
| Kling 3.0 | 15s | 6 |
| Kling 1.x–2.6 | 5–10s | 1（连续长镜） |
| Veo 3.x | 8s | 1 |
| MiniMax H3 | 15s | 1（一镜到底） |

---

## 12. U11 落点画面法则

每一段都要有一个明确的**最后一帧**。模型用它当情绪终点。

- ✅ 「结束在他的脸冻在冰箱蓝光里」
- ❌ 「他难过地站在那里」

落点画面同时是五锚点之一（见 `02-dramaturgy.md` §13）。**命名它是不可省的。**

---

## 13. U12 三细节审计（发稿前）

逐镜检查，每镜至少各有一条：

1. 环境压力（光、天气、表面、房间的声音）
2. 身体微动作（下颌、手、呼吸、眼、姿态）
3. 声音锚点或贯穿情绪的视觉母题

零条 → 修。只有一条 → 问自己能否在不臃肿的前提下补到两条。**本技能所有范例都是三条齐的。**

自动检查：`python scripts/check_prompt.py 你的稿子.txt --total 45 --model kling3`

---

## 14. 负向提示词策略

| 模型 | 负向能力 | 做法 |
|---|---|---|
| Kling（独立负向字段） | 强 | 字段里**不要写 no**，直接写东西本身：`distorted hands, extra fingers, melted face, watermark, subtitles, jitter` |
| Veo | 中 | 正文里用正向描述，`Audio:` / `SFX:` 标签分离声音指令 |
| Seedance 1.x | 无 | 全部改写成正向：`no yellow tones` → `cold blue-gray palette, desaturated skin` |
| Seedance 2.0/2.5 | 弱、常被忽略 | 同上，按正向写 |
| MiniMax H3 | 弱 | 负向写进 `constraints` 段，且仍以正向描述为主 |

**默认负向清单（支持的模型才用）：**
`blurry faces, distorted hands, extra fingers, melted features, watermark, subtitles, logo, text overlay, jitter, deformed, cartoon physics`

---

## 15. 提示词压缩顺序

当模型偏好短提示词（Kling 2.5 Turbo、图生视频、H3 的 I2VA），按这个顺序往下砍：

1. 保角色连续性
2. 保故事动作
3. 保时间码
4. 保光
5. 保运镜
6. 保剪辑语法
7. 保声音
8. 删形而上的说明与元评论
9. 删多余形容词
10. 删导演名字

**目标：留骨架，去香水。**

---

*规则体系改编自 Serge Shima《visual-skills》video/references/universal-rules.md（CC BY 4.0）；时长表、模型表、中文术语与脚本联动由 film-director 重写。*
