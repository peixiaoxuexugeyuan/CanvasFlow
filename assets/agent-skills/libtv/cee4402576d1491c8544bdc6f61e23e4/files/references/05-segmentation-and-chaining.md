# 05 · 分段规划与衔接设计

## 目的

当诉求时长超过单段生成上限，片子必须被切成 N 段分别生成，再拼回一条。这一章保证三件事：**时长加总精确、边界落在节拍上、接缝看不出来**。

---

## 一、段数公式

```
单段上限 MAX_SEG = 15 秒（H3 系列默认；换模型时按该模型单次生成上限替换）
段数 N = ceil(T / MAX_SEG)
```

总时长 TN每段典型时长节拍总数（按标准）≤ 15 s1T见表 0416–30 s28–15 s8–1231–45 s310–15 s10–1546–60 s411–15 s11–1761–75 s512–15 s13–2076–90 s612–15 s14–2391–105 s713–15 s16–26106–120 s813–15 s17–28

---

## 二、时长分配算法（必须精确到帧）

### 原则

1. `Σ 各段时长 = T`，误差 **0 帧**
2. 各段尽量均匀（最长与最短之差 ≤ 2 秒）
3. 每段 ≥ 3 秒（禁止碎片段）
4. 每段 ≤ MAX_SEG
5. 每段时长落在 **0.5 秒网格**上（便于人工核算与平台对齐）

### 算法（0.5 秒网格 + 均匀分散余量）

```
unit          = 0.5 秒
total_units   = round(T / unit)          # T 先规范到 0.5 的倍数
base_units    = floor(total_units / N)
extra         = total_units − base_units × N

for i in 0..N−1:
    lo = floor(i × extra / N)
    hi = floor((i+1) × extra / N)
    seg_units[i] = base_units + (hi − lo)
```

余量按位置均匀分散，避免"前段全长、后段全短"。

### 实例：T = 47 秒

```
total_units = 94, N = 4, base = 23, extra = 2
→ units = [23, 24, 23, 24]
→ 秒数 = [11.5, 12.0, 11.5, 12.0]
→ 合计 = 47.0 ✓
```

### 实例：T = 60 秒

```
total_units = 120, N = 4, base = 30, extra = 0
→ [15.0, 15.0, 15.0, 15.0] = 60.0 ✓
```

### 实例：T = 90 秒

```
total_units = 180, N = 6, base = 30, extra = 0
→ 六段各 15.0 = 90.0 ✓
```

### 帧级核算

段 i 帧数 `F_i = seg_sec[i] × 30`（整数）。总帧 `ΣF_i = T × 30`。 若 T 不是 1/30 的整数倍，末段吸收余数帧，并在节点计划里标注实际帧数。

直接跑：

```bash
python scripts/plan_promo.py --duration 47 --max-seg 15 --json
```

输出结构：

```json
{
  "total_sec": 47.0,
  "total_frames": 1410,
  "beat_range": [10, 15],
  "beat_actual": 12,
  "segments": [
    {"i": 1, "start": 0.0, "end": 11.5, "sec": 11.5, "frames": 345, "beats": 3},
    {"i": 2, "start": 11.5, "end": 23.5, "sec": 12.0, "frames": 360, "beats": 3},
    ...
  ],
  "sum_check": 47.0
}
```

---

## 三、段边界必须落在节拍边界上

### 协调顺序（关键）

1. 先按第二节算出**建议切点**
2. 排节拍表时，让节拍边界**尽量**贴住建议切点
3. 若冲突，**动节拍不动切点**：把跨越切点的那一拍内的镜头重新分配，让切点正好落在两拍之间
4. 允许切点与理想位置差 **≤ 1 秒**；超过 1 秒则重排节拍

### 为什么不能切在动作中段

- 段是独立生成的，段尾的动作会被模型"收尾"，段首的动作会"重新起手"——接起来就是一顿。
- 切在节拍边界上，段尾是 `settle`（画面已稳），段首是 `setup`（重新建立），衔接自然。

### 段尾/段首的运动意图约束

位置允许的运动意图禁止段尾最后一拍brake / settlecommitment、impact段首第一拍setup / anticipationimpact整片最后一拍settle（定格 ≥1.5 秒供阅读 + LOGO 安全边距）任何运动整片第一拍setup → impact（3 秒内完成钩子）长铺垫

---

## 四、节拍配额分配

总节拍数落在标准区间 `[lo, hi]`。分配到各段：

```
每段配额 ∝ 该段时长
每段 ≥ 1
每段 ≤ beat_range(该段时长).hi
Σ 配额 ∈ [lo, hi]
```

### 实例（T=47，4 段）

标准区间 10–15，取 12。按段长比例：

```
11.5 s → 2.94 → 3 拍
12.0 s → 3.06 → 3 拍
11.5 s → 2.94 → 3 拍
12.0 s → 3.06 → 3 拍
合计 12 ✓
```

每段 3 拍 / 11.5–12 秒 → 单拍约 3.9 秒，镜数每段约 5–7 镜。这个密度适合品牌长版。

### 分配不均时的处理

若某段时长明显偏长（如 5 段 90 秒里的 18 秒段），给它 4 拍而不是 3 拍——**长段长拍**，否则那一拍会拖。

---

## 五、五类衔接法

超过 1 段时，**每个接缝必须指定一种**，并写进相邻两段的提示词。

### L1 · Frame Chain 尾帧续接（首选）

项内容适用连续动作、连续运镜、同一空间、同一主体做法段 N 渲染完成后导出末帧 → 作为段 N+1 的首帧输入（I2VA / FL2VA）强度最高，几乎无缝代价必须等前一段出图，串行执行

提示词写法：

段 N 尾部：

```
OUT-POINT STATE: At 00:11.5 the camera has settled at a medium close-up, the product
standing still on the counter with a soft key light from screen-left; no motion blur,
no pending gesture, frame is stable for the final 0.5 seconds.
```

段 N+1 头部：

```
MODE: I2VA
IN-POINT STATE: Continuation of the previous segment's final frame — identical camera
position, identical lighting direction, identical product placement. Begin from this
exact state and continue with a slow, steady push-in.
```

### L2 · Match Cut 动作匹配

项内容适用动作方向或速度可延续，但不方便导出末帧做法段尾动作的**方向 / 速率 / 构图重心**与段首一致强度高代价需要对运动参数写数值锚

提示词写法：

段 N 尾：`...the hand exits frame to the right at a constant gentle speed.`段 N+1 首：`...a hand enters frame from the left at the same constant gentle speed, continuing the same motion path.`

> 方向要接得上：出右 → 从左入，视觉上才是"继续走"；出右 → 从右入是"回头"。

### L3 · Bridge 动效桥接

项内容适用空间跳转、时间跳跃、主体更换做法段尾 0.4 秒遮挡动效（光晕横扫 / 色块擦除 / 失焦 / 粒子掠过）；段首 0.4 秒同款反向展开强度中，明显但可接受代价每次用会"切断"连续性，全片不超过 2 次

提示词写法：

段 N 尾：`...the last 0.4 seconds are covered by a soft horizontal light sweep moving left to right, fully obscuring the frame at the cut point.`段 N+1 首：`...the first 0.4 seconds are revealed by the same soft horizontal light sweep continuing left to right, uncovering a new space.`

> 同向 + 同速度 + 同材质，是桥接成立的三要素。反向会显得像倒放。

### L4 · Reverse Push 反向推拉

项内容适用需要"呼吸感"换场景，两段构图相近做法段 N 推近收尾（画面变紧）→ 段 N+1 同构图拉远起手（画面变松）强度中代价两端构图必须相似，否则显得跳跃

提示词写法：

段 N 尾：`...ends at a tight close-up, the subject filling 70% of the frame, camera at rest.`段 N+1 首：`...starts from the same tight framing and pulls back slowly and steadily to a wide shot, revealing the surrounding space.`

### L5 · Sound Bridge 声音桥

项内容适用视觉必须硬切，但听觉要连续做法BGM 节拍、混响尾音、环境底噪跨段不中断；视觉直接切强度低（视觉上仍有明显切点）代价只能"减轻"，不能"消除"

提示词写法：

段 N：`overall_soundscape` 写 `...the ambient hum continues past the end of this segment without fading.`段 N+1：`overall_soundscape` 写 `...the same ambient hum is already present at full level on the first frame.`

### 选择顺序

```
能导出末帧？ → L1 Frame Chain
不能，但动作可延续？ → L2 Match Cut
场景必须换？ → L3 Bridge（全片 ≤2 次）
构图相近但要呼吸？ → L4 Reverse Push
以上都不行 → L5 Sound Bridge + 接受硬切
```

---

## 六、四类接缝的完整范例

### 接缝 A · 连续动作接缝（47 秒 / 4 段 / 段 1→2）

```
段 1 (00:00–00:11.5)  段尾：用户的手停在按钮上方，指尖离屏幕 2 cm
段 2 (00:11.5–00:23.5) 段首：同一只手、同一角度，指尖落下
衔接法：L1 Frame Chain
```

段 1 尾：

```
OUT-POINT STATE: 00:11.5 — the fingertip rests 2 cm above the button, hand fully still,
soft window light from the right, shallow depth of field on the button.
```

段 2 头：

```
IN-POINT STATE: Continuation of the previous segment's final frame. The same hand at the
same angle, the fingertip still 2 cm above the button. The press begins in the first
0.3 seconds with a slow, steady downward motion.
```

### 接缝 B · 场景跳转接缝（60 秒 / 4 段 / 段 2→3）

```
段 2 尾：室内近景，产品在桌上
段 3 首：户外，产品在手上
衔接法：L3 Bridge（光扫）
```

段 2 尾：

```
OUT-POINT STATE: ...the final 0.4 seconds are covered by a soft horizontal light sweep
moving left to right, washing the frame to near-white at the cut point.
```

段 3 首：

```
IN-POINT STATE: ...the first 0.4 seconds are revealed by the same soft horizontal light
sweep continuing left to right, uncovering an outdoor setting with the product held in
one hand, warm afternoon light.
```

### 接缝 C · 时间跳跃接缝（90 秒 / 6 段 / 段 4→5）

```
段 4 尾：白天，忙碌的操作
段 5 首：夜晚，同一空间，安静
衔接法：L4 Reverse Push + L5 Sound Bridge
```

段 4 尾：`...ends at a tight shot of stacked paper trays, camera at rest, the room tone continuing past the cut.`段 5 首：`...starts from the same tight framing on the same paper trays and pulls back slowly to a wide night shot of the same room, now empty, lit only by one desk lamp.`

### 接缝 D · 段落转场（长片双环之间）

```
环一结束 → 环二开始
衔接法：L3 Bridge（色块擦除）+ 主体更换
```

这是全片最大的一次转场，可以"用力"。给 0.5 秒，色块取品牌主色，擦除方向与环二开头的运镜方向一致。

---

## 七、分段表字段

用 `assets/segment-plan-template.md` 填，每段一行：

段起止秒数帧数节拍配额主导视觉衔接法（入）衔接法（出）节点名

表下必须有一行核算：

```
Σ 段时长 = 47.0 s ＝ 诉求 47.0 s ✓     Σ 帧数 = 1410 ＝ 47×30 ✓
```

---

## 八、常见错误

错误后果修法段数按"每 10 秒一段"拍脑袋时长对不上，或段太短模型收不住用公式 + 脚本切点落在动作中段接起来一顿移到节拍边界全片 4 个接缝都用 Bridge每 12 秒闪一次，像幻灯片至少一半用 L1/L2段尾给了 impact模型在结尾强行"爆发"，接不上段尾只给 brake/settle每段时长不等且差距大节奏乱，且配额难分均匀 + 余量分散忘了末段吸收余数帧总帧数少 1–2 帧帧级核算所有段都用同一提示词只改时长内容重复每段独立写，见 06