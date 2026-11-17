# 六套 STYLE_LOCK 风格锁定库（平面大湿版）

每个分支的风格块在生成时**原样注入** prompt 头部，负面约束注入负面提示（若模型无负面提示栏则并入主 prompt 尾部，前缀「避免：」）。 `[PRIMARY]` `[SECONDARY]` `[ACCENT]` 在 G5 色卡通过后替换为实际 hex 值。

多模型方言原则：LibTV 内模型对中英文 prompt 理解力不同——中文模型（可灵/万相/Seedream/海螺）直接使用中文风格块；英文系模型（Midjourney 等）使用 English Core 行替换中文风格块。

---

## STYLE_LOCK_A — MG 扁平动画

```
扁平矢量插画风格，纯色块填充，无渐变无阴影，几何化人物造型，
简洁圆润造型语言，明亮高饱和配色，主色[PRIMARY]辅色[SECONDARY]，
大面积纯色背景，现代商业MG动画美学，画面干净克制

English Core: flat vector illustration, solid color blocks, no gradient no shadow,
geometric character design, clean rounded shapes, bright saturated palette,
minimal flat background, modern motion-graphics aesthetic
```

**负面约束**：写实照片、3D渲染、水彩晕染、油画笔触、手绘铅笔感、像素风、赛博朋克、噪点纹理、复杂光影、渐变滥用

### A 红色变体（素材含党政元素时追加）

红色模式下，主 prompt 追加 `red-compliance.md` 的注入模板（双旗/党徽场景描述），负面约束追加：

```
旗帜倒挂、旗帜倒置、旗面褶皱破损、双旗一高一低、双旗前后错位、
党徽偏心、国徽与旗帜同墙并列、象征物置于不雅位置、任何标识叠加于国旗上方
```

---

## STYLE_LOCK_B — 2.5D 等距插画

```
2.5D等距插画，30度等距视角，统一光源方向的柔和渐变与投影，
几何体块建筑与物件，轻立体材质，干净现代配色，主色[PRIMARY]，
精致细节层次，等距网格空间秩序感，科技产品展示美学

English Core: isometric illustration, 30-degree isometric view, soft gradient
with consistent directional lighting, geometric block buildings, light 3D materials,
clean modern palette, detailed layering, product showcase aesthetic
```

**负面约束**：写实照片、自由透视/两点透视、鱼眼畸变、手绘涂鸦、像素风、强硬阴影、水彩、油画

---

## STYLE_LOCK_C — 商务信息图

```
商务信息图设计，极简现代排版，大面积留白，扁平化图标与数据图表，
深蓝主色[PRIMARY]配强调色[ACCENT]，清晰视觉层级（标题>数据>辅助说明），
专业严谨克制，现代企业数据报告美学，无装饰性元素

English Core: business infographic design, minimalist modern layout, generous
whitespace, flat icons and data charts, deep blue primary with accent color,
clear visual hierarchy, corporate data-report aesthetic, no decorative clutter
```

**负面约束**：卡通人物、手写字体、涂鸦、照片背景、花哨装饰、3D效果、渐变滥用、插画场景

---

## STYLE_LOCK_D — 剪纸拼贴（双变体）

### D-flat 平面变体（默认）

```
剪纸拼贴艺术，真实纸质纹理与纤维感，多层纸张叠加制造景深，
手工裁剪的毛边边缘，温暖色调主色[PRIMARY]，
柔和侧光在纸层间投下细腻阴影，童话手工书美学，每处材质都是纸，
角色为单层平面剪纸片

English Core: paper cutout collage art, real paper texture and fibers, layered
paper depth, hand-cut rough edges, warm palette, soft side lighting casting
delicate shadows between paper layers, storybook craft aesthetic,
characters as flat single-layer paper cutouts
```

### D-3D 立体变体（G10 选立体角色时启用）

```
立体纸雕与弹出书艺术，真实纸质纹理与纤维感，纸张折叠出厚度与体积，
角色为立体折纸/纸雕造型带真实投影，多层纸艺场景带景深层次，
温暖色调主色[PRIMARY]，柔和侧光强化立体层次，童话立体书美学

English Core: 3D papercraft and pop-up book art, real paper texture, paper
folded into volume and thickness, characters as 3D origami papercraft with
realistic shadows, layered paper scenes with depth, warm palette, soft side
lighting enhancing dimensionality, storybook pop-up aesthetic
```

**负面约束**：数码光泽、3D渲染（指CG渲染感，非纸雕立体）、写实照片、矢量光滑边缘、霓虹色、金属质感、玻璃质感、塑料感

---

## STYLE_LOCK_E — 手绘涂鸦

```
手绘涂鸦插画，马克笔粗线条带自然抖动，白板干净背景，
线稿为主局部填色，手写标注文字与箭头，轻松即兴的知识分享感，
主色[PRIMARY]仅用于强调元素，讲师白板授课美学

English Core: hand-drawn doodle illustration, marker pen strokes with natural
wobble, clean whiteboard background, line art with partial coloring, handwritten
annotations and arrows, casual knowledge-sharing whiteboard aesthetic
```

**负面约束**：精致矢量、完美直线、3D渲染、写实照片、复杂渐变、印刷感、厚涂油画、全彩填满

---

## STYLE_LOCK_F — 温暖绘本

```
温暖绘本插画，水彩晕染底色与彩铅细节，柔光滤镜笼罩，
圆润柔软线条，奶油暖色调主色[PRIMARY]，
童话氛围与细腻纸张纹理，治愈系睡前故事美学，光影温柔有呼吸感

English Core: warm picturebook illustration, watercolor wash base with colored
pencil details, soft glow filter, rounded gentle lines, creamy warm palette,
fairytale atmosphere, fine paper texture, healing bedtime-story aesthetic
```

**负面约束**：高对比硬边、霓虹色、赛博朋克、3D渲染、写实照片、冷峻工业风、深色压抑色调

---

## 附录：色卡图生成 prompt（G5 使用）

```
极简色卡设计，5个纯色矩形色块横向平铺，色值依次为
[PRIMARY] [SECONDARY] [ACCENT] [NEUTRAL_LIGHT] [NEUTRAL_DARK]，
每块下方标注小字hex值，纯白背景，平面设计风格，无装饰

English Core: minimalist color palette card, 5 solid rectangular swatches in a row,
hex codes labeled below each, pure white background, flat design
```

色卡图生成后作为图片节点固定于画布，每镜出图时作为参考图绑定（配方见 model-matrix.md）。