# 标准色卡提示词协议

## 目录

1. 核心原则
2. 何时使用
3. 先整理色彩数据
4. 固定提示词结构
5. 三元素版式
6. 文字与色值准确性
7. 功能标签写法
8. 完整英文模板
9. 《路西法协议》示例映射
10. 常见失败
11. 交付检查

## 1. 核心原则

色卡是制作管理文件，不是电影画面。即使项目本身要求写实、颗粒、光影和材质，色卡仍应是精确、无摄影元素的 flat 2D 信息设计。

色卡提示词的任务是锁定：

- 颜色的 exact HEX；
- 从左到右的固定顺序；
- 每个颜色的 scene function 或叙事职责；
- 标题、副标题和标签的逐字文本；
- 禁止模型把色卡生成成纸张、桌面、实体色票或艺术海报。

## 2. 何时使用

当用户要求色卡、色板、palette reference、color system、配色规范、视觉 Bible 色彩页、Figma/Illustrator 风格参考页或色彩提示词时，使用本协议。

用户只要提示词时，只交付可复制提示词，不生成图片，不附加不必要说明。

## 3. 先整理色彩数据

在写提示词前建立 palette ledger：

| ID | 色名 | HEX | 层级 | 功能标签 | 使用条件 | 禁用条件 |
|---|---|---|---|---|---|---|
| 01 |  | #000000 | 世界/角色/节拍 |  |  |  |

检查：

- HEX 使用六位大写格式 `#RRGGBB`；
- ID 从 01 连续编号；
- 色块顺序与功能标签顺序完全一致；
- 每种颜色至少有一个可执行功能；
- 区分 project lock、场景色和节拍强调色；
- 同一强调色不要承担互相冲突的意义；
- 背景色不计入色块数量，除非用户明确要求。

## 4. 固定提示词结构

默认按以下顺序输出：

1. 资产类型、画幅与纯平面声明；
2. 背景的 exact HEX 与无材质约束；
3. `The composition contains exactly three elements:`；
4. `ELEMENT 1`：标题与副标题；
5. `ELEMENT 2`：单行色块、数量、顺序、exact HEX；
6. `ELEMENT 3`：HEX 文本与 function label；
7. `TEXT ACCURACY`；
8. `OVERALL DESIGN SPECIFICATION`；
9. `AVOID`。

除非用户另有要求，默认使用 16:9 horizontal layout。4–13 色使用单一横排；超过 13 色时优先拆成多张同规格色卡，不擅自改成拥挤多行。

## 5. 三元素版式

### ELEMENT 1 — Title

只包含主标题和副标题。写明：

- 位置：top center；
- 字体类别：clean sans-serif；
- 主标题和副标题的 exact text；
- 字色与层级；
- 不添加 logo、图标、编号或装饰线。

### ELEMENT 2 — Swatches

只包含色块：

- exactly N rectangular color swatches；
- single horizontal row；
- identical dimensions；
- evenly spaced；
- exact left-to-right order；
- solid flat fill；
- sharp edges；
- no gradient, shadow, border, bevel, gloss or lighting effect。

### ELEMENT 3 — Labels

每个色块下方只放两行：

1. exact HEX，monospace；
2. function label，smaller sans-serif。

标签顺序必须与色块顺序一一对应。

## 6. 文字与色值准确性

必须加入 `TEXT ACCURACY` 区块并要求：

- all text exactly as written；
- do not translate, abbreviate, rewrite or omit；
- do not invent extra captions；
- do not reorder HEX codes or labels；
- do not add color names unless explicitly listed；
- no logo or watermark。

图像模型仍可能写错文字。提示词用于提高成功率，但正式生产设计文档应优先用 Figma、Illustrator、SVG、HTML/CSS 或其他确定性排版工具复核 exact HEX 和文本。

## 7. 功能标签写法

function label 描述颜色在叙事或美术系统中的职责，不只复述色名。

优先写：

- 世界功能：industrial infrastructure、sterile control zone；
- 角色/阵营功能：authority uniform、protagonist identity；
- 节拍功能：blood activation、danger cue、revelation accent；
- 材质功能：oxidized metal、failed tissue fluid；
- 信息状态：dormant、active、contaminated、forbidden。

避免只写 `beautiful red`、`cinematic blue`、`dark color` 等无 scene function 的标签。

## 8. 完整英文模板

```text
A clean digital color palette reference design for a film production design bible, 16:9 horizontal layout, pure flat design aesthetic with no photographic elements.

The background is a solid neutral [BACKGROUND NAME] [BACKGROUND HEX] fill, completely flat, with no texture, no shadow, no paper, no surface, no gradient.

The composition contains exactly three elements:

ELEMENT 1 — Title at the top center:

Clean modern sans-serif typography in solid [TITLE HEX]. The main title reads exactly:

"[MAIN TITLE]"

Directly below the main title, in smaller [SUBTITLE COLOR] sans-serif typography:

"[SUBTITLE]"

ELEMENT 2 — A single horizontal row of [N] rectangular color swatches:

Place exactly [N] rectangular color swatches in one evenly spaced horizontal row, centered vertically in the frame.

Every swatch must have identical dimensions, sharp clean edges and a completely solid flat color fill.

No gradient, no shadow, no border, no bevel, no gloss and no lighting effect.

The [N] swatches from left to right must use these exact HEX fills:

01: [HEX]
02: [HEX]
[CONTINUE IN EXACT ORDER]

ELEMENT 3 — Two lines of text directly beneath each swatch:

Under every swatch, place exactly two centered lines of text.

The first line is the exact HEX code, set in clean monospace typography, color [HEX TEXT COLOR].

The second line is the function label, set in smaller clean sans-serif typography, color [LABEL COLOR].

The [N] function labels from left to right are:

01: [FUNCTION LABEL]
02: [FUNCTION LABEL]
[CONTINUE IN EXACT ORDER]

TEXT ACCURACY:

All titles, HEX codes and function labels must appear exactly as written.

Do not translate, abbreviate, rewrite, reorder or omit any text.

Do not add numbering, logos, icons, decorative symbols, watermarks or additional captions unless explicitly listed.

OVERALL DESIGN SPECIFICATION:

This is a precise flat 2D digital graphic layout, like a color management reference sheet created in Figma or Adobe Illustrator for a professional film production design bible.

The aesthetic is clinical, informational, minimal, controlled and highly professional.

This is not a cinematic scene. No depth, no perspective, no lighting, no photographic rendering and no physical-material simulation.

Pure flat vector-style color swatches on a flat background with crisp typography and generous spacing.

AVOID:

photographic rendering, photorealism, cinematic scene, character portrait, environment illustration, paper texture, desk surface, table surface, physical color chips, depth of field, lens blur, film grain, 3D render, lighting effects, gradients, shadows beneath swatches, glossy finish, bevels, borders, hand-painted appearance, watercolor, sketch, decorative poster design, infographic icons, extra text, logo, watermark, mockup of a physical object, real-world object simulation.
```

## 9. 《路西法协议》示例映射

本示例展示如何把视觉 Bible 转成色卡数据，不要求其他项目复用这些颜色：

| ID | HEX | function label |
|---|---|---|
| 01 | #2A2D35 | oppressive steel infrastructure |
| 02 | #0A0B0E | abyssal shadow and blackout |
| 03 | #E8E4DF | sterile clinical control |
| 04 | #8B1A1A | Lucifer blood activation |
| 05 | #3A5C3A | failed biomechanical tissue |
| 06 | #6B3FA0 | metal-flesh conflict glow |
| 07 | #A0522D | rust and human decay accent |

背景使用 `#F5F2EC`，主标题使用 `#1A1A1A`，HEX 文本使用 `#333333`，功能标签使用 `#666666`。

## 10. 常见失败

### 把电影风格画进色卡

失败：加入人物、废墟、烟雾、胶片颗粒或灯光。

修正：电影风格只通过颜色和文字职责被描述；色卡本身保持 no photographic、无材质的 flat 2D。

### 色值准确但没有功能

失败：标签只有“红、蓝、灰”。

修正：把颜色绑定到世界、阵营、材质、信息或剧情节拍。

### 提示词没有锁定数量

失败：模型擅自增减色块、标题或装饰。

修正：重复使用 exactly N、exactly three elements、single horizontal row 和 do not add。

### 负面词与设计目标冲突

失败：项目要求电影级写实，色卡提示中也要求 photorealistic 和 film grain。

修正：区分“项目内容风格”与“文档图形风格”；色卡永远优先精确、平面、无摄影。

## 11. 交付检查

- 是否只在用户要提示词时只交付提示词？
- 是否写明 16:9、flat 2D 和 no photographic？
- 是否包含 exactly three elements？
- ELEMENT 1、ELEMENT 2、ELEMENT 3 是否职责单一？
- 色块数量、HEX、顺序和 function label 是否一一对应？
- 是否包含 TEXT ACCURACY？
- 是否包含 OVERALL DESIGN SPECIFICATION 和 AVOID？
- 是否区分 project lock、场景色与节拍强调色？
- 每种颜色是否拥有明确 scene function？
- 是否禁止模型添加纸张、桌面、实体色票、阴影、渐变和多余文字？

