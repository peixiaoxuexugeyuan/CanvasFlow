# 模型 · Seedance（字节跳动）

> **一句话定位**：唯一能"一次生成里塞进多个镜头"的模型。广告、短片、多镜叙事首选。
> 弱项：2.0 之后对真人脸过滤很凶，人脸戏要走 1.5 Pro 或换 Kling / Veo。

---

## 1. 版本与规格

| 版本 | 分辨率 | 单次时长 | 关键能力 |
|---|---|---|---|
| 1.0 Pro | 1080p | 5–10s（API 到 12s） | 多镜能力强 |
| 1.0 Lite | 720p | 5–10s | 快、便宜 |
| 1.5 Pro | 1080p | 5–10s | 原生音频 + 口型 |
| 2.0 | 480/720/1080p、4K | 5–12s | 9 种运镜预设、12 路 `@` 引用、弱负向 |
| 2.0 Mini | 同上 | 5–12s | 约 2 倍速、便宜 30%，打草稿用 |
| **2.5** | 最高 4K | **30s 一条过** | 50 路多模态引用、3D 白盒机位、局部重绘 |

画幅：16:9 / 4:3 / 1:1 / 3:4 / 9:16 / 21:9 / 9:21。帧率 24–30fps。

**选型**：人脸剧情 → 1.5 Pro；场景/产品/蒙太奇 → 2.0；15–30s 连续叙事 → 2.5；草稿 → 2.0 Mini。

---

## 2. 参数（写在末尾）

```text
--resolution 1080p --duration 5 --camerafixed false --seed 42
```

- `--resolution` 480p / 720p / 1080p
- `--duration` 2–12（Pro）
- `--camerafixed` true 锁机位
- `--seed` 复现

---

## 3. 生产级骨架（11 块，正式稿必用）

```text
[1] 角色锁
    Use @img1 as the identity reference and preserve the exact same person across the whole clip: <六件套身份块>. Dress her in <逐件服装>. No extra characters.

[2] 时长 + 类型 + 剪辑意图
    Generate a <N>-second multi-shot <genre> sequence with <fast / slow / staircase> dynamic editing.

[3] 故事（一段话）
    <这一段里发生的具体物理事件，现在时。写清起点、转折、落点。>

[4] 视觉风格
    <色板、反差、颗粒、色温、明确排除什么。质感词：皮肤、布料、表面。>

[5] 摄影风格
    <机身感（如 Sony FX3 handheld）。镜头带用途：35/50mm 中景，85mm 情绪近景，100mm macro 插入，24mm 宽剪影。硬切，不要连续长镜。>

[6] 剪辑风格
    <硬切 or 匹配切。节奏升级。停顿落在哪。冲击落在哪。阶梯：长→短→更短→停顿→冲击。>

[7] 声音
    <按顺序列环境声、微动作声、冲击声、静音点、最后一声。No dialogue / No subtitles / No on-screen text（如需要）。>

[8] 逐镜时间轴
    Shot 1, 0.0–X.X sec: <景别、焦段、运镜、动作、环境细节、情绪转成的身体动作>。
    Shot 2, X.X–Y.Y sec: <...>。

[9] 光（复述并具体）
    <主光、补光、轮廓光；方向；色温；它承载什么心理——审判、孤立、希望、悲伤。>

[10] 构图
    <主体在画框的位置、负空间、倒影、剪影、前景遮挡。必须命名落点画面。>

[11] 输出规格
    <精确时长、画幅、写实程度。--resolution 1080p --duration 5 --camerafixed false>
```

**为什么是 11 块**：每块挡一种失败——身份漂移、长镜坍塌、情绪糊、镜头乱、声画不搭、节奏漂。便宜的保险。

---

## 4. 多镜语法（独有能力）

支持的切点标记：

```text
Shot 1. <描述>
Cut to. <描述>
Camera cut to. <描述>
Camera switching. <描述>
Lens switch to. <描述>
```

行内写法：

```text
[Shot A] -> Cut to -> [Shot B] -> Camera cut to -> [Shot C]
```

**用量纪律**：5 秒 2–3 镜最稳；4–5 镜只在每个节拍都极短且物理上截然不同时用。**硬上限 5 镜/次**，超了模型会丢镜或压缩。4 镜就要给 10–15s，不要挤在 5s 里。

**相邻镜必须共享一个锚**（同一个角色 / 同一地点 / 同一套光），否则会生成互不相干的片段。

---

## 5. 防糊保险段（多镜前必加）

```text
Important direction:
This must be a clearly edited multi-shot sequence with visible cuts between shots. Do not generate a single continuous take. Each shot must have a different camera angle and different framing. Use rapid montage pacing with rhythmic escalation. Keep the same character appearance throughout. Preserve the same clothing, face, body type, hairstyle in every shot. The tone is <serious cinematic drama / tragicomedy / documentary realism>.
```

这是 Seedance 提示词里性价比最高的一段。上一次出来是"一条连续长镜"时，加它。

---

## 6. 引用语法

- `@img1` `@img2` … 图片引用；**每条引用后面必须跟完整身份块**（图像会漂，文字是后备信号）。
- `@Video1` 运动/风格参考（480–720p），`@Audio1` 配音/音乐，要在正文里说明各自角色。
- 2.0 上限 12 个文件（≤9 图 / 3 视频 / 3 音频）；2.5 上限 50。
- 多段拼接时，**每一段都重复身份块**。

---

## 7. 图生视频规则

**不要描述图里已经有的东西。** 模型看得见。重描静态元素会引发身份漂移。

- ❌ `A man in a red shirt stands in a kitchen. He walks to the fridge.`
- ✅ `He slowly walks toward the fridge, opens it with hesitation, freezes when he sees the empty shelves. Tracking shot from behind, 35mm.`

---

## 8. 音频（1.5+）

- 台词用**双引号**，模型会配音并对口型。
- 短句才稳，长独白会漂；拆成几句，用切口保持同步。
- 不要配乐就明写 `No music`，否则会自动铺广告式配乐。
- 字幕：先描述画外音，再要 `text along the bottom edge, timed to the voice`。

---

## 9. 失败模式

| 现象 | 修法 |
|---|---|
| 要蒙太奇给成长镜 | 加"防糊保险段"+ 显式 `Cut to.` |
| 跨镜身份漂移 | 每个镜边界重复身份块 |
| 5 秒以下运动被忽略 | 多动作/多运镜场景最少 5s |
| 负向无效 | 改正向陈述（1.x 无负向解析） |
| 5 秒塞 4 镜以上失败 | 减到 2–3 镜，或延长到 10–15s |
| 情绪糊、每镜都像同一帧 | 相邻镜功能不能重复（Establish/Detail/Reaction 要换） |
| 真人脸被拒 | 换 1.5 Pro / Kling / Veo |

---

## 10. 15 秒三段的拆法（模板）

15 秒**永远不是一条提示词**，是三段各自自足的 5 秒，剪辑里接起来。每段：完整身份锁 + 完整视觉风格 + 完整音频块 + 不同的戏剧功能。

```text
Beat A（0–5s，Hunger）  她发现空的冰箱，绝望翻成希望
Beat B（5–10s，Cooking） 开火、水沸、期待升高
Beat C（10–15s，Break）  东西掉了，湿闷一声，切黑
```

**衔接**：A 结束在她的手伸进冰箱 → B 开场她的手已经在冰箱里，同样的冷光（L2 动作接）。

---

*Seedance 章节改编自 Serge Shima《visual-skills》video/references/seedance.md（CC BY 4.0），已按本技能的分段体系重排。*
