# 08 · 无限画布节点编排

## 目的

在无限画布上把"分段生成 → 合成"的物理过程摆出来。**节点数量 = 段数，一个不多一个不少；节点上的时间区间 = 分段表上的时间区间，一位不差。**

---

## 一、节点计划表（必交）

每段一行，字段固定：

| 字段 | 说明 | 示例 |
|---|---|---|
| `node_name` | 全局唯一命名 | `PROMO_ACME_47s_S2of4_11.5-23.5` |
| `node_type` | vid / img / txt / aud | `vid` |
| `segment` | `i of N` | `2 of 4` |
| `time_in` | 全局起始 | `00:11.5` |
| `time_out` | 全局结束 | `00:23.5` |
| `duration` | 秒数 | `12.0 s` |
| `frames` | 帧数 | `360` |
| `beats` | 节拍号 | `4–6` |
| `mode` | 生成模式 | `I2VA` |
| `input` | 输入来源 | `S1 out-point frame` |
| `prompt_file` | 提示词文件路径 | `prompts/S2_11.5-23.5.txt` |
| `link_in` | 入接缝 | `L1 Frame Chain` |
| `link_out` | 出接缝 | `L2 Match Cut` |
| `depends_on` | 前置节点 | `S1` |

表下核算行：

```
Σ duration = 47.0 s ＝ 诉求 47.0 s ✓
Σ frames   = 1410   ＝ 47 × 30 ✓
node count = 4      ＝ ceil(47 / 15) ✓
```

---

## 二、画布排布

### 布局（从左到右 = 时间顺序）

```
y = 0    [TXT 00_brief]  [TXT 01_brand_truth]  [TXT 02_provenance]  [TXT 03_beat_sheet]  [TXT 04_segment_plan]

y = 240  [IMG S1_keyframe] ─→ [VID S1 00:00.0-11.5] ─┐
                                                        │
         [IMG S2_keyframe] ─→ [VID S2 00:11.5-23.5] ─┤
                                                        │
         [IMG S3_keyframe] ─→ [VID S3 00:23.5-35.0] ─┤
                                                        │
         [IMG S4_keyframe] ─→ [VID S4 00:35.0-47.0] ─┴─→ [VID FINAL_concat 00:00.0-47.0]

y = 520  [TXT S1_prompt]  [TXT S2_prompt]  [TXT S3_prompt]  [TXT S4_prompt]
         （各自垂直挂在对应 VID 下方）
```

### 规则

1. **视频节点按时间从左到右**，x 间隔均匀；同一 y 轴，不要错落
2. **提示词文本节点挂在对应视频节点正下方**，便于重跑与追溯
3. **关键帧节点（若用）在视频节点左侧**，箭头指向消费它的视频节点
4. **FINAL_concat 置于最右**，标注总时长与总帧数
5. **依赖箭头必须画**：`S1 → S2 → S3 → S4 → FINAL`，Frame Chain 的段必须有实线箭头
6. **全部节点归入同一 group**，命名 `<BRAND>_PROMO_<TOTAL>s`

### 不做的事

- 不要把视频节点排成矩阵（2×2），会让人以为可以并行任意顺序
- 不要省略提示词节点
- 不要给"备用方案"建平行节点树，会污染画布；备选方案放文本节点里

---

## 三、命名规范

```
PROMO_<BRAND>_<TOTAL>s_S<i>of<N>_<t0>-<t1>
```

- `BRAND`：大写，无空格，无特殊字符
- `TOTAL`：总秒数，整数
- `t0` / `t1`：秒数，一位小数，用连字符分隔

示例：

```
PROMO_ACME_47s_S1of4_0.0-11.5
PROMO_ACME_47s_S2of4_11.5-23.5
PROMO_ACME_47s_S3of4_23.5-35.0
PROMO_ACME_47s_S4of4_35.0-47.0
PROMO_ACME_47s_FINAL_0.0-47.0
```

配套文本节点：

```
PROMO_ACME_47s_TXT_brief
PROMO_ACME_47s_TXT_brand_truth
PROMO_ACME_47s_TXT_provenance
PROMO_ACME_47s_TXT_beat_sheet
PROMO_ACME_47s_TXT_segment_plan
PROMO_ACME_47s_TXT_S2_prompt
```

---

## 四、派发顺序（串行 vs 并行）

| 衔接法 | 能否并行 | 说明 |
|---|---|---|
| L1 Frame Chain | **不能** | 必须先出段 N 的末帧，才能生成段 N+1 |
| L2 Match Cut | 可以 | 靠运动参数约定，不依赖实际帧 |
| L3 Bridge | 可以 | 两端动效参数约定即可 |
| L4 Reverse Push | 可以 | 构图约定即可 |
| L5 Sound Bridge | 可以 | 视觉无依赖 |

因此：**若全片都用 L1，就是纯串行流水线**；若混用，可先把 L2–L5 的段并行跑，再补 L1 的段。

派发时每条任务必须自包含：模型、画幅、参考图路径、完整提示词、目标时长。不要让下游任务去猜上游的输出。

---

## 五、合成节点

`FINAL_concat` 的输入是 N 个视频节点，按 `time_in` 升序拼接。

合成后必须核对：

- [ ] 合成时长 = 诉求总时长（误差 0 帧）
- [ ] 无重复帧（段尾帧与段首帧相同会导致卡顿 1 帧）
- [ ] 无黑帧（段与段之间不留空隙）
- [ ] 音频无爆音（接缝处做 20 ms 交叉淡化）
- [ ] 末段 LOGO 未被裁切

若用 Frame Chain，段 N+1 的首帧就是段 N 的末帧，拼接时**要丢掉段 N+1 的第 1 帧**，否则会有 1 帧静止。

---

## 六、多画幅交付

同一片要出 16:9 与 9:16 两版时：

- **重新规划**，不要把 16:9 裁成 9:16（会切掉主体）
- 9:16 版减少横向信息：去掉左右并列的卡片，改为纵向堆叠
- 9:16 版节拍可略快（信息在竖屏里停留更短）
- 两版共用品牌事实表、溯源清单、色态系统，**各自独立出节拍表与分段表**
- 画布上分成两个 group：`_16x9` 与 `_9x16`

---

## 七、节点计划示例（T=47，4 段，混用衔接）

```
group: ACME_PROMO_47s

00  TXT  00_brief
01  TXT  01_brand_truth
02  TXT  02_provenance
03  TXT  03_beat_sheet
04  TXT  04_segment_plan

10  VID  S1of4  00:00.0–11.5  11.5 s  345 f  beats 1–3   T2VA           link_out L1
11  VID  S2of4  00:11.5–23.5  12.0 s  360 f  beats 4–6   I2VA(from S1)  link_in L1  link_out L2
12  VID  S3of4  00:23.5–35.0  11.5 s  345 f  beats 7–9   I2VA(from S2)  link_in L2  link_out L4
13  VID  S4of4  00:35.0–47.0  12.0 s  360 f  beats 10–12 I2VA(from S3)  link_in L4

20  VID  FINAL   00:00.0–47.0  47.0 s 1410 f   concat of 10–13

30  TXT  S1_prompt   (挂 10 下)
31  TXT  S2_prompt   (挂 11 下)
32  TXT  S3_prompt   (挂 12 下)
33  TXT  S4_prompt   (挂 13 下)

核算  Σ = 11.5+12.0+11.5+12.0 = 47.0 ✓    Σf = 345+360+345+360 = 1410 ✓
```

派发顺序：`S1 → S2`（Frame Chain 链，串行）→ 导出 S2 末帧给 S3？视衔接法而定。
若 `S2→S3` 用 L2、`S3→S4` 用 L4，则 S3、S4 与 S2 可并行。
