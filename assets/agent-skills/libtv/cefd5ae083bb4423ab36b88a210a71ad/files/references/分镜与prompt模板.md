# 分镜与 prompt 模板（和服妖异）

写 prompt 的**总原则**：先气韵总纲统领 → 正面气质引导 → 否定词只在 negative 块。正向不堆砌 `no ears / no tail / no skull`。

---

## 一、气韵总纲句（每个 prompt 第一句必写）

```
Everything breathes the same breath — the woman, her flowing kimono, her drifting
hair, the faint torii in gold lines — all rendered in hair-thin lines that dissolve
at the edges, as if the whole scene were a half-remembered dream of a yōkai.
```
（中文意：万物同息——妇人、飘逸和服、飘散长发、淡金线鸟居，皆以尾端消散的极细线绘成，仿佛整幕是一段将醒未醒的妖梦。）

---

## 二、Negative Prompt 块（和服妖异专属，压制动漫化 + 恐怖化）

直接复制到生成工具 negative 栏：
```
fluffy fox ears, cute kemonomimi, anime catgirl, chibi, mascot anime style,
realistic animal tail, furry ears, plush cosplay, dense floral kimono pattern,
big sparkly anime eyes, moe face, smiling cute face,
skull face, ghoul, horror grotesque, scary face, blood splatter, gore,
rotting flesh, demonic ugly monster, jump-scare,
volumetric shading, soft 3d skin, subsurface scattering, chiaroscuro,
photorealistic, 3d render, octane render, glossy highlight, baroque oil painting,
depth of field photograph, environmental lighting
```

---

## 三、彩稿妖异基础模板（竖版全身）

```
[气韵总纲句]
Amano-style kimono yōkai illustration, full-body vertical portrait,
[子类型描述，如 a fox-spirit woman],
in three-quarter profile, face turned slightly away,
thin gaunt androgynous face with a razored pointed chin, long narrow eyes with
lowered lids, oversized vacant pupils gazing downward and past the viewer,
an expression of eerie elegant detachment touched with sadness, never a cute
anime face, never a horror skull face,
elongated neck and limbs, floating without gravity, no anatomical weight,
hair as a few decisive long lines that drift and dissolve at the ends, sharing
one floating breath with the kimono, never a solid mass,
flowing kimono with swaying sleeves and obi in [色系锚点配色], suggested by
gold-thin strokes and a few decisive lines, Heian-Meets-Art-Nouveau motifs —
waves, vines, petals; patterns hinted not dense,
[环境：a faint torii gate behind her, suggested by a few pale gold lines, hollow,
no solid fill, dissolving into the void],
traditional illustration: colored inks and gold leaf layered over a visible pencil
underdrawing, re-inked with wispy black line, on a deep black / pale paper ground,
the black ink line is the dominant statement; color is a translucent wash laid over
it, matte gold leaf, no glossy highlight, no glowing bloom,
flat decorative clarity — no volumetric shading, no soft 3d skin, no cast shadow,
no chiaroscuro; the figure is ghost-like and translucent,
hair-thin lines with broken breathing weight, dry-brush fragments, contours
unclosed,
asymmetrical — figure right 40%, the rest dissolving void with faint gold lines
and a thin silver moon,
eerie elegance, restrained palette, 2.39:1 cinematic ratio
```
（竖版静帧用 1024×1792；横版成片用 1536×640 / 1920×800，把「full-body vertical」改「full-body」并把构图拉宽。）

---

## 四、案例 A（狐妖彩稿）【优质】— 对应已通过验证图方向

**主题**：天野流狐妖，竖版全身、人物为主体、淡金线鸟居背景、美学妖异非志怪
**情绪曲线**：静滞→微动→妖艳凝滞→余韵消散
**视觉符号**：鸟居淡线（镜1初现、镜3呼应）、长发金线（贯穿）、朱红和服

**成片 prompt（镜2 妖���凝滞，可直接出图 / 图生视频首帧）**：
```
Everything breathes the same breath — the fox-spirit woman, her red-and-indigo
kimono, her drifting hair, the faint torii in pale gold lines — all rendered in
hair-thin lines that dissolve at the edges, as if the whole scene were a
half-remembered dream of a yōkai.
Amano-style kimono yōkai illustration, full-body vertical portrait,
a fox-spirit woman of elegant eerie beauty, in three-quarter profile, face turned
slightly away,
thin gaunt androgynous face with a razored pointed chin, long narrow eyes with
lowered lids, oversized vacant pupils gazing downward and past the viewer,
an expression of eerie elegant detachment touched with sadness, never a cute
anime face, never a horror skull face,
elongated neck and limbs, floating without gravity, no anatomical weight,
hair as a few decisive long black-and-gold lines that drift and dissolve at the
ends, sharing one floating breath with the kimono, never a solid mass,
flowing kimono in vermilion red and indigo with matte gold-thread waves and vines
suggested by a few decisive strokes, sleeves and obi swaying,
a faint torii gate behind her, suggested by a few pale gold lines — two pillars and
one crossbeam, hollow, no solid fill, dissolving into the void,
traditional illustration: colored inks and gold leaf layered over a visible pencil
underdrawing, re-inked with wispy black line, on a deep black ground,
the black ink line is the dominant statement; color is a translucent wash laid over
it, matte gold leaf, no glossy highlight, no glowing bloom,
flat decorative clarity — no volumetric shading, no soft 3d skin, no cast shadow,
no chiaroscuro; the figure is ghost-like and translucent, mass dissolved,
hair-thin lines with broken breathing weight, dry-brush fragments, contours
unclosed,
asymmetrical — figure occupies most of the frame right-of-center, the rest
dissolving black void with faint gold lines and a thin silver moon,
eerie elegance, restrained palette, 2.39:1 cinematic ratio
```

---

## 五、案例 B（源氏女性彩稿）【优质】

**主题**：天野流《源氏物语》贵族女性，金朱 + 苍白纸，哀艳妖异
**prompt（镜2）**：
```
Everything breathes the same breath — the Heian lady, her vermilion-and-indigo
robe, her escaping hair pins, the pale moon — all rendered in hair-thin gold-and-
ink lines that dissolve at the edges, as if a Genji chapter had dissolved into
dream.
Amano-style kimono yōkai illustration in the manner of The Tale of Genji,
full-body vertical portrait, a noble Heian woman of sorrowful detachment,
in three-quarter profile, face turned slightly away,
thin gaunt androgynous face with a razored pointed chin, long narrow eyes with
lowered lids, oversized vacant pupils gazing downward, an expression of noble
melancholy touched with eerie grace,
elongated neck and limbs, floating without gravity, no anatomical weight,
elaborate updo with a few long escaping hair lines and slender gold pins, sharing
one floating breath with the robe,
layered Heian robe in vermilion red, indigo and pale paper white, gold leaf
motifs — waves, vines, plum — suggested by thin gold strokes, not dense,
a faint torii and cherry branches in pale gold lines behind her, hollow, dissolving
into void,
traditional illustration: colored inks and gold leaf over a visible pencil
underdrawing, re-inked with wispy black line, on a pale paper / deep black ground,
the black ink line dominant; translucent wash; matte gold, no glossy bloom,
flat decorative clarity — no volumetric shading, no soft 3d skin, no cast shadow,
no chiaroscuro; ghost-like and translucent,
hair-thin broken lines, dry-brush fragments, contours unclosed,
asymmetrical — figure lower-right, the rest dissolving void with a thin gold moon,
eerie elegance, restrained palette, 2.39:1 cinematic ratio
```

---

## 六、分镜表（成片用，含每镜动画提示词）

视频成片采用**双轨分镜**：① 图文 prompt（出静帧）② 每镜独立**动画提示词（motion）**，描述该镜发 / 和服 / 环境线的具体微动 + 转场 + 循环。

### 8 列分镜表（狐妖 · 无叙事呼吸式 · 空灵 Ambient）

| 镜 | 时长 | 模式 | 主体/动作 | 构图 | 线条/色彩 | 符号呼应 | 镜头运动 | 每镜动画提示词(motion) |
|----|------|------|-----------|------|-----------|----------|----------|------------------------|
| 1 | 6s | 彩稿 | 黑底金线渐显，狐妖全身浮现 | 偏右40% | 金线黑底 | 鸟居淡线初现 | 极缓推 | gold lines emerge from black, hair-thin breath, no camera shake |
| 2 | 5s | 彩稿 | 妖艳凝滞 | 同上 | 朱红和服 | 长发金线 | 定格 | figure still, only hair ends and sleeve drift 3%, torii lines faint breathe |
| 3 | 6s | 彩稿 | 衣袂华满 | 同上 | 金线微光 | 鸟居呼应镜1 | 随漂移 | obi gold-thread sways 2%, torii lines glow matte |
| 4 | 7s | 彩稿 | 余韵消散 | 溶黑 | 金退散 | 发线呼应 | 溶解转场 | gold fades to black, petals dissolve, seamless loop to shot1 |

（妖精 / 画皮式同理，换色系锚点与符号：妖精→群青 + 月；画皮→苍白红 + 梅枝。）

### 动画提示词（motion）写法铁则
- 幅度极低：飘浮位移 ≤ 画面 5%，发 / 衣袂尾端缓动；天野流是「微动」非「大动作」。
- 运动类型限 `drift / float / breathe / sway / dissolve`，禁 `walk / run / fight / zoom`。
- 转场只用 `dissolve / bloom / fade`，禁硬切。
- 循环：首尾帧线语言一致，溶解相接，周期 4–8s，与情绪曲线同步。
- 运镜动机 = 角色漂移或衣袂飘动，禁无动机随机抖动（破坏气韵同源）。
