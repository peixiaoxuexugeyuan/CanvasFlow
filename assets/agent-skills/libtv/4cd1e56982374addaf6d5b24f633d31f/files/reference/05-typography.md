# 05 · 字体系统

用户只选一项：「主要用哪类字体」。其余（字重、字距、大小写、图文间距）全部由 SKILL 按公式推导，不再追问。

---

## 一、用户可选的四类字体

| 选项 | 字形特征 | 气质 | 适配行业 | 代表字族 |
|---|---|---|---|---|
| **几何无衬线** | 正圆、正方的骨架，O 接近正圆 | 当代、理性、科技 | 科技、设计、建筑、B2B | Futura、Montserrat、Poppins、Space Grotesk、思源黑体 |
| **现代人文无衬线** | 骨架带手写痕迹，字腔更开 | 亲和、可信、耐读 | 餐饮、教育、服务、医疗 | Helvetica Now、Inter、Söhne、DM Sans、阿里巴巴普惠体 |
| **高对比衬线** | 粗细对比极强，笔画末端有装饰 | 高级、权威、经典 | 奢侈、出版、律所、酒店 | Playfair Display、Bodoni、Canela、Instrument Serif、思源宋体 |
| **定制字母标** | 为这几个字母专门画的字，不合字库 | 独占、无法撞车 | 品牌名短、要走高端线 | 自绘，参考 A2/M09 |

> 需要「圆润亲和」时不要单列第五类，直接用几何无衬线 + 大圆角处理（如 Poppins / 汉仪润圆 思路）即可。选项越少，用户决策越快。

---

## 二、字重与字距（按公式推导，不凭感觉）

| 参数 | 规则 | 说明 |
|---|---|---|
| 品牌名字重 | **Medium - Bold（500-700）** | 低于 500 在小尺寸会消失 |
| 符号内文字 | 不适用（纯图标版无文字） | —— |
| 字距（拉丁） | 在默认基础上 **+5% ~ +10%** | 品牌名需要「呼吸感」，收紧会显廉价 |
| 字距（中文） | **+2% ~ +5%** | 中文本身密度高，不宜大幅加宽 |
| 全大写 | 字距 **+12% ~ +18%** | 大写字母加宽是硬需求 |
| 字重对比 | 主名 : 副标 ≥ 2 个字重级差 | 如 Bold + Regular |

**为什么默认加宽**：字距收紧是 2010 年代的互联网习惯，用于 UI；品牌标需要「被读成一个整体」而不是「一行字」，加宽反而让它变成图形。

---

## 三、图文组合的排布比例

| 关系 | 公式 | 备注 |
|---|---|---|
| 图标宽 : 文字高 | 文字高度 = 图标高度 × **60%-80%** | 超过 80% 会压过图标 |
| 图标与文字间距 | = 图标宽度 × **30%-50%** | 小于 30% 会粘连 |
| 横排总宽 : 高 | 近似 **2.4 : 1 ~ 3.2 : 1** | 超出说明名字太长，考虑缩写 |
| 英文全大写时的总宽 | 自动 +8% 预留 | 避免裁切 |
| 竖排（图上字下） | 字宽 ≈ 图宽 × **85%-100%** | 名字超过 6 字改横排 |

**对齐方式**：一律**视觉居中**，不是数学居中。
- 圆形图标与文字横排时，图标需**右移 1-2%**（圆形视觉重心偏左）
- 三角/尖角图形需**下移 1%**（尖角视觉外扩）

---

## 四、中英混排规则

| 情况 | 处理 |
|---|---|
| 纯中文品牌 | 用中文全称，不用缩写（除非用户明确要求） |
| 纯英文品牌 | 优先全大写或首字母大写；**禁止全小写**（除非刻意的互联网调性） |
| 中英双语 | 图文组合版**只出现一种语言**，优先中文；纯图标版无语言问题 |
| 中文 + 英文副标 | 副标字号 ≤ 主名 40%，字距 +15%，全大写 |
| 品牌有官方英文名 | 用官方英文名，不要自行音译 |

---

## 五、字体气质对照（细分选择）

| 想要的感觉 | 中文 | 英文 |
|---|---|---|
| 极简当代 | 思源黑体 Light/Regular | Inter、DM Sans、Söhne |
| 科技精密 | 阿里巴巴普惠体、汉仪旗黑 | Space Grotesk、Sora、Archivo |
| 亲和圆润 | 汉仪润圆、站酷快乐体 | Poppins、Outfit、Nunito |
| 力量硬朗 | 站酷高端黑、优设标题黑 | Anton、Bebas Neue、Archivo Black |
| 高级优雅 | 思源宋体、方正兰亭宋 | Playfair Display、Canela、Cormorant |
| 编辑感 | 霞鹜文楷、思源宋体 | Fraunces、Instrument Serif、Bricolage |
| 手工温度 | 得意黑、手写体 | Recoleta、手绘字标 |
| 复古印刷 | 方正清刻本悦宋 | Cooper、Bookman、Cooper Black |

**免费可商用优先**（中文）：思源黑体 / 思源宋体 / 阿里巴巴普惠体 / 得意黑 / 霞鹜文楷 / 站酷系列。

---

## 六、提示词里的字体写法

图像生成模型不认识具体字体文件，但认识「字形描述」。写法公式：

```
[骨架] + [字重] + [细节处理] + [排布]
```

| 类型 | 提示词片段 |
|---|---|
| 几何无衬线 | `geometric sans-serif wordmark, perfect circular O, uniform stroke width, medium-bold weight, wide letter spacing` |
| 人文无衬线 | `humanist sans-serif, open apertures, slightly narrower forms, medium weight, generous tracking` |
| 高对比衬线 | `high-contrast didone serif, hairline thin strokes with heavy stems, refined serifs, wide tracking, all caps` |
| 定制字标 | `custom-drawn letterforms, modified terminal, single intentional quirk in one letter, otherwise disciplined structure` |
| 粗斜体 | `heavy condensed italic, 10-degree forward slant, tight counters, blocky terminals` |
| 手写 | `hand-lettered brush script, natural stroke variation, connected baseline, slight overshoot` |

**必加约束**（否则模型会自己加装饰）：
`no drop shadow, no outline stroke on type, no gradient fill on type, no 3D bevel, letters must remain legible at small size`

---

## 七、五个常见错误

1. **字重太细** —— Light 以下的字在 32px 下直接消失。品牌名最低 Medium。
2. **全小写当潮流** —— 除非是刻意的互联网调性（如 `dunkin'`），否则显不专业。
3. **中英混排两行都很大** —— 变成双语说明书。副标必须明显小。
4. **字距收紧** —— 显得急促、廉价。品牌标默认加宽。
5. **在文字上加描边/阴影** —— 一旦加，就再也无法单色印刷。
