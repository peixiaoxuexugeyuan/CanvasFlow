# 完整案例 · Annotated Examples

本文档是 MJ Prompt Expert 的深度参考，展示三条完整提示词的构建全过程——从弱提示词到强提示词的每一步推理。

---

## 案例一：产品摄影

### 弱提示词

```
a beautiful perfume bottle on a table
```

**问题诊断：**
- `beautiful` 是填充语，不映射任何视觉特征
- `a table` 没有指定表面材质——表面决定了画面下半部分的全部视觉信息
- `perfume bottle` 没有指定瓶身材质——玻璃的反射特性完全缺失
- 没有光线、镜头、色彩、画幅

### 强提示词构建过程

**第 1 步：确定产品在什么表面上**

不是 `a table`，而是：
```
clean cream linen surface
```
表面决定了画面下半部分的全部视觉信息。

**第 2 步：确定瓶身材质（双写法）**

不是 `perfume bottle`，而是：
```
frosted glass perfume bottle with brass cap, condensation droplets on glass
```
- 磨砂玻璃 → 漫反射和柔和的边缘高光
- 黄铜 → 暖色金属镜面反射
- 冷凝水珠 → 微距级的表面不规则反射

这些不是形容词，是渲染指令。

**第 3 步：确定光源**

不是 `beautiful lighting`，而是：
```
soft side lighting from a single window
```
- 单窗 → 方向性明确的单向软光
- 自然光衰减
- 无辅光补充的暗部

**第 4 步：确定镜头**

```
85mm macro lens, shallow depth of field
```
- 85mm → 压缩背景
- 微距 → 揭示表面纹理
- 浅景深 → 焦点锁定在瓶身标签或瓶盖细节上

**第 5 步：确定色彩身份**

```
Kodak Portra 400, product photography
```
- Portra 400 → 暖调肤色友好的色彩倾向
- product photography → 锚定商业摄影的构图惯例

### 最终提示词

```
frosted glass perfume bottle with brass cap, condensation droplets on glass,
soft side lighting from a single window, clean cream linen surface,
85mm macro lens, shallow depth of field, Kodak Portra 400, product photography
--ar 4:5 --style raw --stylize 50 --v 8.1 --no text, logo, watermark
```

### 参数选择理由

| 参数 | 值 | 理由 |
|------|-----|------|
| `--ar 4:5` | Instagram 产品帖子标准画幅 | 电商场景 |
| `--style raw` | 抑制自动美化，确保摄影质感而非绘画渲染 | 产品摄影必加 |
| `--stylize 50` | 将模型美学干预压到最低 | 确保输出忠实于产品描述 |
| `--no text, logo, watermark` | 排除文字干扰 | 产品图干净 |

---

## 案例二：电影感环境肖像

### 弱提示词

```
a detective in a rainy city at night
```

**问题诊断：**
- `a detective` 是抽象标签，不是画面
- `rainy city at night` 太笼统——3am 的雨夜与 8pm 的雨夜是完全不同的视觉
- 没有光线、镜头、胶片、画幅

### 强提示词构建过程

**第 1 步：从时间和天气的具体性开始**

`3am` 不是晚上——3am 意味着城市进入最深睡眠的时段、街道空寂、路灯成为唯一光源。

雨天不是「下雨」——`rain-soaked asphalt` 意味着地面的反射率从干燥的约 0.1 变为湿润的约 0.3–0.5，每一个光源都在地面上投射出倒影。

```
rain-soaked asphalt street at 3am
```

**第 2 步：添加中景氛围层**

```
steam rising from a manhole cover
```
为画面添加了一个中景氛围层，将二维的街景变成有纵深的三维空间。

**第 3 步：主体具体化**

不是 `a detective`，而是：
```
middle-aged detective in a worn trench coat, tired eyes, five o'clock shadow
```
- 风衣的磨损状态
- 眼部的疲劳迹象
- 面部毛发的半日生长

这些都是物理上可见的、可以渲染的具体细节。`detective` 是一个抽象标签，这些才是画面。

**第 4 步：光线完全依赖实用光源**

```
practical lighting only from streetlamp and distant neon
```
- 不加任何隐藏补光
- 阴影会深到丢失细节
- 轮廓光会从路灯的边缘溢出勾勒人物的侧面轮廓

这正是黑色电影的经典光比。

**第 5 步：镜头与画幅**

```
35mm lens, low angle, anamorphic aspect
```

### 最终提示词

```
middle-aged detective in a worn trench coat, tired eyes, five o'clock shadow,
standing under a flickering streetlamp, rain-soaked asphalt street at 3am,
steam rising from a manhole cover,
35mm lens, low angle, anamorphic aspect,
practical lighting only from streetlamp and distant neon,
deep shadows with rim light edge separation,
Cinestill 800T, film noir cinematography
--ar 21:9 --style raw --stylize 200 --v 8.1
```

### 参数选择理由

| 参数 | 值 | 理由 |
|------|-----|------|
| `--ar 21:9` | 强制超宽银幕电影构图 | 黑色电影美学 |
| `--style raw` | 抑制自动美化 | 电影质感必加 |
| `--stylize 200` | 适度创意偏离 | 允许模型在 film noir 传统内发挥 |
| 胶片 Cinestill 800T | 钨丝灯白平衡 + 红色光晕 | 霓虹黑色电影不可替代 |

---

## 案例三：概念插画

### 弱提示词

```
a futuristic city
```

**问题诊断：**
- `futuristic` 太笼统——是赛博朋克还是 solar-punk？视觉完全不同
- 没有视角、色彩、媒介

### 强提示词构建过程

**第 1 步：选择具体类型**

Solar-punk（太阳能朋克）而非 generic cyberpunk——这是对类型的明确选择。

```
solar-punk city built into a giant vertical forest
```

**第 2 步：添加具象视觉元素**

```
transparent skybridges connecting treehouse-like structures,
flying personal drones between buildings
```
每一个都是具象的、可渲染的视觉元素。

**第 3 步：光线与视角**

```
warm morning light filtering through canopy layers,
wide establishing shot, bird's eye perspective gradually descending
```
`bird's eye perspective gradually descending` 暗示了动势和空间关系。

**第 4 步：色彩约束**

```
muted greens and warm golds palette
```
将色彩约束在自然-科技的融合感中。

### 最终提示词

```
solar-punk city built into a giant vertical forest,
transparent skybridges connecting treehouse-like structures,
flying personal drones between buildings,
warm morning light filtering through canopy layers,
wide establishing shot, bird's eye perspective gradually descending,
architectural illustration style, muted greens and warm golds palette
--ar 16:9 --stylize 400 --v 8.1
```

### 参数选择理由

| 参数 | 值 | 理由 |
|------|-----|------|
| `--ar 16:9` | 水平叙事 | 概念插画展示 |
| `--stylize 400` | 高创意自由度 | 概念插画需要模型创意发挥 |
| 无 `--style raw` | 允许模型美学干预 | 概念插画非写实摄影，需要绘画质感 |

### 与案例一、二的对比

| | 案例一（产品） | 案例二（肖像） | 案例三（概念） |
|---|---|---|---|
| `--style raw` | 必加 | 必加 | 不加 |
| `--stylize` | 50（最低） | 200（适中） | 400（高） |
| `--ar` | 4:5（IG） | 21:9（电影） | 16:9（展示） |
| 媒介 | 摄影 | 摄影 | 插画 |
| 创意自由度 | 最低 | 适中 | 最高 |

**规律：** 越偏写实摄影，`--style raw` 必加、`--stylize` 压低；越偏艺术插画，`--style raw` 不加、`--stylize` 推高。

---

## 总结：从弱到强的通用升级路径

每条弱提示词都可以通过以下路径升级为强提示词：

1. **抽象标签 → 具体物理细节**（`detective` → `middle-aged detective in worn trench coat, tired eyes`）
2. **笼统环境 → 精确时空**（`rainy city at night` → `rain-soaked asphalt street at 3am`）
3. **缺失光线 → 四变量齐全**（补全光源类型 + 方向 + 光比 + 色温）
4. **无镜头 → 显式焦段**（添加 24mm/35mm/50mm/85mm/200mm/macro）
5. **无色彩身份 → 胶片型号**（Portra 400 / Cinestill 800T / HP5 等）
6. **无画幅 → 显式 `--ar`**
7. **填充语删除**（masterpiece / 8K / beautiful 全部移除）
8. **材质双写**（物理属性 + 光学响应）
