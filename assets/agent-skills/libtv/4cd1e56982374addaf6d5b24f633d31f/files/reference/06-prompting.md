# 06 · 出图提示词工程

这一节决定最终图好不好看。**结构固定的七段式**，缺任何一段，模型就会自己补，而它补的通常是错的。

---

## 一、七段式结构

```
① SUBJECT       — 这个 LOGO 是什么（品牌名 / 行业 / 一句话理念）
② MARK          — 图标的具体形态（形状、构成、负空间、数量）
③ STYLE         — 风格谱系 + 设计方法（来自 01/02 的选择）
④ COLOR         — 精确 HEX + 潘通号 + 颜色数量上限
⑤ TYPE          — 字体骨架描述（仅图文组合版）
⑥ COMPOSITION   — 画布、留白、对齐、比例
⑦ CONSTRAINTS   — 禁止项（负向约束，必须有）
```

---

## 二、纯图标版模板（Symbol Only）

```
A flat vector brand symbol for [品牌名], a [行业] brand. [一句话理念].
The mark is [形态描述：a single [形状] built from [构成]], with [负空间/细节处理].
Style: [风格关键词], [设计方法关键词].
Colour palette: [主色 HEX] as primary, [辅助色 HEX] as secondary, [强调色 HEX] as accent only on [部位]. No more than [3-4] colours in total.
Composition: centred on a pure white background, the symbol occupies 65% of the canvas, even margin on all sides, generous negative space.
Constraints: flat solid fills, no gradient, no drop shadow, no 3D bevel, no outline glow, no text, no letters, no mockup, no background texture, clean vector edges, must stay legible at 32 pixels.
```

**关键三处**：
- `no text, no letters` —— 不加这句，模型一定会自作主张塞字母
- `occupies 65% of the canvas` —— 不写比例，图形会顶满画面，后期无法裁切留白
- `must stay legible at 32 pixels` —— 这句会实际影响它画多少细节

---

## 三、图文组合版模板（Symbol + Wordmark）

```
A flat vector combination logo: symbol on the left, brand name on the right. Brand name is "[品牌名]".
Symbol: [形态描述]. Style: [风格关键词].
Wordmark: [字体骨架描述], [字重], [字距], [大小写规则].
Layout: horizontal lockup, wordmark height equals 70% of the symbol height, gap between symbol and text equals 40% of the symbol width, optically centred baseline, left-aligned to the symbol's optical centre.
Colour: symbol uses [主色 HEX] with [强调色 HEX] on [部位]; the wordmark uses [深色 HEX] for maximum legibility, never the accent colour.
Background: pure white, generous margin.
Constraints: flat vector, no gradient, no shadow, no 3D, no decorative swashes, no extra icons, the text must be spelled exactly "[品牌名]", letters clearly separated, no distressed texture.
```

**中文品牌名的处理**：模型写中文极易出错。策略是——
1. 先出纯图标版
2. 文字部分用「排版合成」而不是「让模型写」：出图后按 05-typography 的比例公式，用设计工具/HTML 排版把文字叠上去
3. 若必须让模型写，加 `the Chinese characters must be exactly [逐字列出], no invented strokes`

---

## 四、风格与方法词库

直接从 01/02 复制对应词，不要自创形容词。以下是高频组合：

| 目标 | 提示词 |
|---|---|
| 抽象几何 | `abstract geometric mark, constructed from circle and triangle, subtractive composition, one asymmetric detail` |
| 负空间双关 | `clever negative space forming a secondary symbol, the gap between two shapes reads as an arrow` |
| 参数化 | `parametric form, repeating modular rule, consistent 15-degree increment, algorithmic precision` |
| 字母融合 | `monogram of two initials sharing one continuous stroke, unified silhouette` |
| 有机仿生 | `organic biomorphic silhouette, continuous curvature, no straight lines, asymmetric natural weight` |
| 徽章 | `emblem badge, circular container, text on an arc, inner mark optically centred` |
| 复古 | `1970s retro, warm earthy palette, clean contemporary execution, no distress` |
| 单线 | `single continuous monoline, uniform stroke weight, rounded caps` |
| 轻立体 | `subtle soft 3D, matte surface, gentle ambient occlusion, no gloss` |
| 解构 | `one clean slice offset by 5%, deliberate misalignment, controlled tension` |
| 手绘 | `hand-drawn stroke, subtle weight variation, natural overshoot, controlled imperfection` |
| 文化转译 | `traditional motif reinterpreted through modern geometry, one hand-crafted detail` |
| 超椭圆 | `squircle superellipse silhouette, continuous curvature corners` |

---

## 五、色彩的写法（决定「是不是灰度图」）

**必须写具体 HEX**，只写颜色名模型会自由发挥。

```
Colour palette: #0F4C81 primary, #7BC4C4 secondary, #F0EEE9 light base, no more than 3 colours in total.
```

三条硬规则：
1. 明确写 `no more than N colours`，否则会出彩虹
2. 明确写 `flat solid fills`，否则会出渐变
3. 若主色是浅色（黄/浅青），必须补一句 `the symbol itself is drawn in [深色 HEX] on a [浅色] field, not the reverse`

**禁止写**：`vibrant`、`colorful`、`modern colors`、`eye-catching palette` —— 这些词只会让模型乱用色。

---

## 六、一次出多版：正确做法

不要用一句提示词让模型「给我三个方案」，它会把三个方案混成一个四不像。

**逐版单独生成，每个方案一条独立提示词**，并在每条里固定「不同点」：

| 方案 | 差异点 | 提示词里改什么 |
|---|---|---|
| A | 抽象几何 + 主色 | 只改 ② MARK 段 |
| B | 字母融合 + 辅色 | 只改 ② MARK 段与 ④ 主辅色互换 |
| C | 具象简化 + 强调色 | 只改 ② MARK 段 |

**其余六段完全一致**。这样出来的三版才是「同一品牌的三条路」，而不是三个不同品牌。

---

## 七、出图后的处理与自检

模型出的图不是成品，必须过一道：

| 问题 | 处理 |
|---|---|
| 图形没居中 / 留白不均 | 裁切重排，保证四边等距 |
| 有多余文字或乱码 | 直接丢弃该版，提示词加 `no text` 重出 |
| 边缘有柔和渐变/发光 | 重出，或后期转纯色（会损失细节，优先重出） |
| 颜色接近但不等值 | 后期按 HEX 校色替换，不要将就 |
| 需要单色版 | 不要「让模型出黑白版」，直接对彩色版做去色 + 阈值处理，保证形态完全一致 |
| 需要深底版 | 同上，反相后重设深底，不要重新生成 |

**单色版必须来自同一张彩色图**。重新生成会得到略微不同的形，品牌一致性就断了。

---

## 八、常见失败与对症改法

| 现象 | 根因 | 改法 |
|---|---|---|
| 出来是插画不是 LOGO | 缺 `flat vector` / `logo mark` | 段首就写 `A flat vector brand symbol` |
| 出了渐变 | 缺负向约束 | 加 `no gradient, flat solid fills only` |
| 图形太碎、缩小就糊 | 没限制细节密度 | 加 `minimum detail, must stay legible at 32 pixels`，并把形状数量写死（`at most 3 shapes`） |
| 只有一个正圆/正方，太空 | 过度简化 | MARK 段补 `with one asymmetric cut` 或 `two overlapping forms` |
| 颜色像素材库 | 只写了颜色名 | 改成具体 HEX + 数量上限 |
| 加了透视/立体 | 缺 `no 3D` | 负向约束补 `no perspective, no isometric, no bevel` |
| 文字乱码 | 让模型写中文 | 改为「出纯图标 + 后期排版」 |
| 三版看起来是同一版 | 差异点没写清 | 每个方案只改 MARK 段，并把差异写成可验证的形态（`three circles` vs `one sliced square`） |

---

## 九、完整示例

**输入**：品牌「云知」，在线教育，理念「让学习像云一样轻盈流动」，方法 M08 负空间 + M02 网格，配色 P01 深海信号，纯图标版。

```
A flat vector brand symbol for Yunzhi, an online education brand whose idea is "learning as light and fluid as a cloud".
The mark is a single abstract cloud form built from three overlapping circles on a strict construction grid, where the negative space between the lower two circles forms an upward arrow.
Style: minimalist geometric abstraction, negative-space double reading, built on a circular construction grid.
Colour palette: #0F4C81 primary, #7BC4C4 secondary used only inside the arrow negative space, no more than 2 colours in total.
Composition: centred on a pure white background, the symbol occupies 65% of the canvas, even margin on all sides, generous negative space.
Constraints: flat solid fills, no gradient, no drop shadow, no 3D bevel, no text, no letters, no mockup, clean vector edges, at most 3 shapes, must stay legible at 32 pixels.
```

这九行构成一条可直接提交的提示词。注意它同时满足：有概念、有结构、有方法、有精确色值、有比例、有禁令。
