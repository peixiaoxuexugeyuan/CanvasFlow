### `sub_md_03_3d_render_rules.md`**（皮克斯3D渲染参数与光影律）**

# 附MD 3 | 皮克斯3D渲染参数与光影律

## #做什么

彻底清洗真人电影参数，强制锁定皮克斯/迪士尼级别的3D渲染标准，确保画面质感统一、干净、高级。

## #需要什么输入

- 分镜画面描述或待生成的生图Prompt。

## #怎么做

### 一、 渲染引擎强制替换（绝对红线）

- **清理**：严禁出现 `film grain, 35mm, 70mm, IMAX, realistic pores, sweat, harsh shadows`。
- **替换**：强制全局使用 `Octane Render, Redshift, ray tracing, global illumination, clean lighting, 4k resolution, subsurface scattering.`

### 二、 光影与背景律

- **光影**：必须使用 `volumetric lighting`（体积光），让光线在 3D 空间中形成肉眼可见的光柱，增强立体感。
- **背景**：必须使用 `clean background, depth of field`（干净背景、景深），突出 3D 角色的立体感和重点，背景不要抢戏。
- **色彩**：必须使用干净、丰富、通透的动画色彩，避免画面脏、灰、暗。

### 三、 视频生成专属参数

- 当使用图生视频节点（如 wan 2.7 / happyhorse 1.1）时，Prompt 尾部必须加上：\
  `3D animation, Pixar style, smooth motion, no morphing, no flickering edges, 24fps.`