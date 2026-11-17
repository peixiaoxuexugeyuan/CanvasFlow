# 材质与光线精控 · Materials & Light

本文档是 MJ Prompt Expert 的深度参考，覆盖材质写法铁律、六类材质的标准写法、禁用词、以及光线的四变量精控体系。

---

## 一、材质写法铁律

材质词是六维框架中投入产出比被严重低估的一个维度。根据工业界实测数据：

| 提示词组件 | CLIPScore 提升幅度 | 稳定性 σ 值 | 评价 |
|-----------|-------------------|------------|------|
| 材质描述 | 12.3 | 0.14 | 最高提升 + 最稳定 |
| 光影修饰 | 9.7 | 0.21 | 高提升，较稳定 |
| 抽象风格词 | 6.1 | 0.33 | 低提升，最不稳定 |

### 铁律：必须同时描述物理属性 + 光学响应

- **物理属性**回答「这东西摸起来什么感觉」
- **光学响应**回答「这东西在光线下怎么反应」

只写「皮夹克」等于什么都没写。要写：

```
aged brown leather with visible grain and scuff marks, catching rim light on worn edges
```

模型才有了具体的东西可以渲染。

## 二、六类材质的标准写法

每种材质的有效写法遵循一个「物理反馈闭环」。

### 织物类

| 材质 | 标准写法 | 要点 |
|------|---------|------|
| 亚麻 | `hand-woven linen, visible slub texture, irregular yarn thickness` | 竹节纹理 + 不规则纱线粗细 |
| 真丝 | `silk fabric laid flat, no tension, smooth surface reflection` | 无张力状态 + 平滑表面反射 |
| 牛仔 | `faded denim with visible weave pattern and frayed edges` | 编织纹理 + 磨损边缘 |
| 羊毛 | `chunky wool knit, visible fiber texture, soft light absorption` | 纤维纹理 + 柔和吸光 |

### 金属类

| 材质 | 标准写法 | 要点 |
|------|---------|------|
| 金属拉丝 | `brushed stainless steel, micro-scratches visible under 45° lighting` | 微划痕 + 具体照明角度 |
| 金属抛光 | `chrome reflecting sunset skyline with warm orange light gradients, sharp specular highlights` | **为反射指定具体内容**，而不是只写「反光的」 |
| 做旧金属 | `oxidized copper with green patina on raised surfaces, raw metal showing in recesses` | 氧化层 + 原始金属对比 |
| 黄铜 | `aged brass with warm specular highlights, visible tarnish around edges` | 暖色镜面反射 + 边缘氧化 |

### 陶瓷与玻璃

| 材质 | 标准写法 | 要点 |
|------|---------|------|
| 陶瓷 | `subsurface scattering, translucent glaze edge` | 次表面散射 + 半透明釉缘 |
| 磨砂玻璃 | `frosted glass with diffused edge highlights, condensation droplets` | 漫反射边缘高光 + 冷凝水珠 |
| 透明玻璃 | `clear glass with sharp specular reflections, visible refraction at edges` | 锐利镜面反射 + 边缘折射 |

### 石材类

| 材质 | 标准写法 | 要点 |
|------|---------|------|
| 哑光石材 | `matte stone surface, no gloss, lifted shadows` | 无光泽 + 提升阴影 |
| 花岗岩 | `granite with visible crystalline flecks, micro-texture catching directional light` | 结晶颗粒 + 方向光微纹理 |
| 大理石 | `polished marble with vein patterns, cool specular reflection on smooth planes` | 纹理 + 冷调镜面反射 |

### 木材类

| 材质 | 标准写法 | 要点 |
|------|---------|------|
| 做旧木材 | `weathered wood with visible grain, split fibers along the edge, warm light pooling in grain grooves` | 木纹 + 纤维分裂 + 光线聚集在纹槽 |
| 抛光木材 | `smooth walnut finish, deep grain visible under raking light` | 光滑表面 + 斜射光下深纹 |

### 皮革类

| 材质 | 标准写法 | 要点 |
|------|---------|------|
| 做旧皮革 | `aged brown leather with visible grain and scuff marks, catching rim light on worn edges` | 纹理 + 擦痕 + 磨损边缘轮廓光 |
| 新皮革 | `smooth tanned leather, even surface with subtle stretch marks, soft highlights` | 均匀表面 + 拉伸纹 + 柔和高光 |

## 三、禁用词（材质相关）

以下词会破坏材质的专属光学参数，**绝不使用**：

| 禁用词 | 原因 | 替代方案 |
|--------|------|---------|
| glossy | 覆盖材质专属光学参数，产出无差别塑料感表面 | 描述具体反射内容：`sharp specular highlights reflecting [具体内容]` |
| shiny | 同上 | `polished surface with defined reflection of [具体内容]` |
| reflective（单独使用） | 同上 | 指定反射的具体内容 |
| soft（面料修饰） | 触发错误的物理逻辑，让面料变成不合理的垂坠形态 | 描述具体编织方式与纹理 |
| flowy | 同上 | 描述面料的物理状态：`fabric laid flat, no tension` |
| drape | 同上 | 描述具体的褶皱形态与重力响应 |
| hyperrealistic | V8.1 中被主动降权 | 删除，用具体材质细节替代 |
| 8K | 同上 | 删除 |
| ultra-detailed | 同上 | 删除 |

---

## 四、光线四变量精控体系

光线本质上可被拆解为四个独立变量的笛卡尔积：

```
光线 = 光源类型 × 光源方向 × 光比 × 色温
```

大多数提示词只处理了光源类型（golden hour、studio lighting），而完全忽略了方向、光比和色温。**这正是画面「通用感」的主要来源。**

### 变量 1：光源类型

光源类型的选择决定了光的质地。

| 光源类型 | 来源 | 阴影特征 | 适用场景 |
|----------|------|---------|---------|
| 软光（soft light） | 大面积光源——窗口光、阴天天空光、大型柔光箱 | 柔和过渡的阴影边缘 | 人像、产品 |
| 硬光（hard light） | 点光源——正午太阳、裸灯泡、聚光灯 | 锐利、边界清晰的阴影 | 戏剧张力、强调纹理 |
| 体积光（volumetric light） | 穿过含颗粒介质的空气——雾、烟、灰尘 | 可见光束 | 氛围、史诗感 |

### 变量 2：光源方向

**方向的精度是区分业余和专业提示词的分水岭。必须指定方向而非只说光型。**

| 方向表述 | 对应视觉结果 |
|----------|------------|
| `from camera-left` | 光从相机左侧来 |
| `from upper right` | 光从右上方来 |
| `backlit from behind subject` | 主体背后逆光 |
| `top-down overhead` | 顶部俯射 |
| `45° front key light` | 45度前侧主光 |

**完整指令示例：**
```
warm directional sunlight from camera-left casting long shadows
```

**反面教材：** `dramatic lighting` 什么都不是——模型会自行脑补一个方向，而那通常不是想要的方向。

### 变量 3：光比（contrast ratio）

光比控制阴影的深度和画面的戏剧张力。

| 光比 | 描述方式 | 视觉效果 |
|------|---------|---------|
| 高光比 | `high contrast lighting, deep shadows, no fill` | 电影感、戏剧性 |
| 低光比 | `soft diffused glow, lifted shadows, subtle fill` | 柔和、商业、友好 |

**光比不是通过形容词来传达的**，而是通过「有没有补光」「阴影有多深」这些具体描述来锚定的。

### 变量 4：色温

色温提供了两条互斥的路径：

| 路径 | 关键词 | 适用场景 |
|------|--------|---------|
| 暖调 | golden hour、tungsten、candlelight、warm amber | 怀旧、亲密、有机质感 |
| 冷调 | blue hour、moonlight、fluorescent、cool cyan | 距离感、科技感、疏离美 |

**在同一画面中冷暖对冲**是电影摄影中最经典的深度塑造手法：

```
warm rim light against cool ambient shadows
```

## 五、经典光线设定速查

| 设定名称 | 完整写法 | 视觉效果 |
|----------|---------|---------|
| 黄金时刻 | `golden hour, warm directional sunlight casting long shadows` | 暖调、有方向性的阳光，长阴影 |
| 蓝调时刻 | `blue hour, cool diffused twilight` | 冷色调、弥漫的暮光 |
| 伦勃朗光 | `Rembrandt lighting, 45° key light creating triangle highlight on shadow side of face` | 面部阴影侧三角高光 |
| 明暗对照法 | `chiaroscuro, single hard light source, extreme light-dark contrast` | 极端亮暗对比，戏剧性 |
| 实用光源 | `practical lighting only from [具体光源]` | 无隐藏补光，仅画面中可见发光体照明 |
| 逆光/剪影 | `backlit silhouette, rim light edge separation, detail lost in shadow` | 优先情绪和形状而非细节 |
| 柔光箱棚拍 | `softbox studio lighting, even flat catalog illumination` | 均匀平坦的目录册式照明 |
| 单窗侧光 | `soft side lighting from a single window, natural light falloff, no fill in shadows` | 方向性明确单向软光，暗部无补光 |

## 六、光线段落构建模板

构建光线段时，按以下顺序填充四个变量：

```
[光源类型] [方向] from [具体光源], [光比描述], [色温描述]
```

**示例：**
```
soft side lighting from a single window, deep shadows with no fill, warm amber tones
```

**示例：**
```
hard practical lighting only from streetlamp and distant neon, high contrast with rim light edge separation, cool cyan ambient with warm neon accents
```
