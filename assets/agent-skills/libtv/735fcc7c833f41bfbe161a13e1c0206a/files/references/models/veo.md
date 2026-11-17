# 模型 · Veo（Google）

> **一句话定位**：原生同步音最强——对白、音效、音乐与画面同时生成且口型准。商业质感、有对白的叙事首选。
> 代价：单次只有 4 / 6 / 8 秒，长片要切很多段。

---

## 1. 规格

- Veo 3：文生视频，原生音频，4 / 6 / 8 秒。
- Veo 3.1：加首帧图生视频、更好的音频、参考食材（reference ingredients）、运动更连贯。
- **单次台词预算：最多 8 秒语速正常的口播。**

---

## 2. 结构（顺序有意义）

```text
[主体 / 动作]
+ [环境]
+ [景别 / 焦段 / 运镜]
+ [光 / 气氛]
+ [风格 / 画质]
+ [Audio / SFX / Says]
+ [时长]
```

甜点区 **50–200 词**。短了自由度高但控制弱；长了控制强但容易自相矛盾。

---

## 3. 台词语法（最容易写错的地方）

**必用：双引号 + 引导动词。**

```text
She says, "Welcome to the future."
He whispers, "Don't move."
She shouts, "Get out!"
```

冒号形式往往更稳：`She says: "..."`

**声音修饰放在引导动词前：**

```text
He says in a weary voice, "We are fine. We are fine."
She whispers nervously, "I don't want to be here."
```

**时长纪律**：8 秒是上限。5 秒塞太多字，语速会不自然。**读一遍，读不完就砍。**

---

## 4. 音效语法

三种写法可混用：

```text
SFX: thunder cracks in the distance
Audio: rain on tin roof, distant traffic, one slow breath
(a loud thunderclap)
(key turning in a lock)
```

**必须用标签**（`Audio:` / `Says:` / `SFX:`）把声音指令和画面指令分开——模型需要明确信号才会生成音频。

---

## 5. 图生视频（3.1）

首帧图作为起点，提示词只写运动、镜头、光的变化、声音。

```text
Maintain the subject from the first frame. Slow push-in, 50mm. She exhales, her eyes shift to the left, one strand of hair falls across her forehead. Warm rim light grows stronger.

Audio: soft breath, distant traffic, one door closing in the next room.
Duration: 6 seconds.
```

**不要重描静态元素。**

---

## 6. JSON 提示词（复杂连续性时用）

比散文更能防止"概念渗透"——描述情绪时不会顺手改掉物件颜色。

```json
{
  "version": "veo-3.1",
  "output": { "duration_sec": 8, "fps": 24, "resolution": "1080p", "aspect_ratio": "9:16" },
  "global_style": {
    "look": "photorealistic live-action",
    "color": "cold blue-gray palette, desaturated skin",
    "mood": "quiet domestic dread",
    "reference": "motivated camera, no handheld drift"
  },
  "continuity": {
    "characters": [
      { "id": "A", "description": "32, oval face, deep brown eyes, shoulder-length black hair, cream high-neck knit sweater, thin silver bracelet right wrist, faint scar on the back of the right hand" }
    ],
    "props": ["door lock with a fresh brass scratch", "phone showing a photo of the lock"],
    "lighting_constant": "cold corridor fluorescent as key from top frame-right; warm lamp as rim from frame-left"
  },
  "scenes": [
    {
      "id": "01",
      "start": "0.0",
      "end": "4.0",
      "shot": { "type": "close-up", "framing": "slightly low, offset right", "camera": "static, 85mm" },
      "action": "Her fingertip stops on a fresh brass scratch around the lock. Her nail drags across the new groove. Her breath stops for half a beat.",
      "environment": "narrow apartment corridor, midnight",
      "lighting": "cold tube light as key, hard shadow under the knuckles",
      "audio": "fluorescent buzz, distant stairwell footsteps"
    }
  ]
}
```

**什么时候用 JSON**：一次多场景、严格跨镜身份、道具颜色尺寸必须不变、散文稿老是串色。

---

## 7. 参考食材（3.1）

```text
The character from reference_1 walks into the location from reference_2 holding the object from reference_3.
```

多图必须逐个说明角色，不要只丢图。

---

## 8. 失败模式

| 现象 | 修法 |
|---|---|
| 台词语速不自然 | 砍到 8 秒以内；读一遍测试 |
| 没有声音 | 加 `Audio:` / `SFX:` / `Says:` 标签，别指望模型自己推 |
| 镜头指令被忽略 | 把镜头放最前面 |
| 加了情绪词，角色颜色变了 | 改 JSON，把情绪关进 `global_style` |
| 口型不对 | 检查引导动词；用冒号形式 |
| 提示词太长被"挑着听" | 压到 50–100 词，或改 JSON |

---

## 9. 分段的现实

8 秒上限意味着：

| 总长 | 段数 |
|---|---|
| 30s | 4（8×4，裁 32→30） |
| 60s | 8 |
| 300s | 38 |

**建议**：Veo 用在"必须同期声"的关键段落（对白、产品口播），其余段落用 Seedance / Kling / H3 拉长，剪辑里统一。

---

*Veo 章节改编自 Serge Shima《visual-skills》video/references/veo.md（CC BY 4.0）；分段建议与中文说明为本技能新增。*
