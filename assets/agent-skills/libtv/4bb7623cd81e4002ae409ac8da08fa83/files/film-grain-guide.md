# IMAX胶片质感与去AI感工程指南

## 目录

- [IMAX胶片视觉特征](#imax胶片视觉特征)
- [瑕疵美学分类体系](#瑕疵美学分类体系)
- [肤质引擎场景版](#肤质引擎场景版)
- [画质锁参数](#画质锁参数)
- [去AI感核心策略](#去ai感核心策略)
- [提示词质感关键词库](#提示词质感关键词库)

## IMAX胶片视觉特征

### 15/70 IMAX画幅的独特性

- 分辨率等效约18K，画面细节极其丰富
- 1.43:1画幅带来沉浸式包围感
- 胶片颗粒在超大画幅下反而更细腻
- 色彩深度和动态范围远超数字格式
- 特有的"呼吸感"：微小的gate weave（片门抖动）

### 胶片 vs 数字/AI生成

| 特征 | 胶片 | 数字/AI生成 |
|------|------|-------------|
| 颗粒 | 有机、不规则、随亮度变化 | 均匀噪声或过于干净 |
| 高光过渡 | 柔和滚降（halation） | 硬切或过曝白 |
| 暗部 | 有层次的噪点 | 纯黑或彩色噪声 |
| 色彩 | 化学染料的有机感 | 过于纯净/数码感 |
| 边缘 | 轻微色散 | 过于锐利 |
| 运动 | 微小抖动和模糊 | 过于稳定或运动模糊不自然 |
| 皮肤 | 纹理保留，毛孔可见 | 过度平滑，塑料感 |

## 瑕疵美学分类体系

去AI感的核心是引入"有机的不完美"。瑕疵分为四大类别，每个镜头必须注入>=3项瑕疵且跨>=2类别。

### 类别一：胶片介质类

与胶片物理化学特性相关的瑕疵：

| 瑕疵 | 描述 | 提示词关键词 |
|------|------|-------------|
| 胶片颗粒 | 随亮度变化的有机颗粒结构 | film grain, organic grain structure, Kodak 500T grain |
| Halation | 高光边缘的橙红色光晕 | warm halation around highlights, highlight bloom |
| 色彩漂移 | 同场景不同镜头间的微色温偏移 | subtle color temperature drift |
| Gate Weave | 片门微抖动 | subtle gate weave, authentic film instability |
| 暗部噪点 | 暗部区域的粗颗粒 | visible grain in shadows, coarse shadow grain |
| 染料不均匀 | 色彩在画面中的微妙不均匀 | subtle dye unevenness, organic color variation |

### 类别二：光学损失类

与镜头光学特性相关的瑕疵：

| 瑕疵 | 描述 | 提示词关键词 |
|------|------|-------------|
| 色差 | 边缘蓝紫色散 | chromatic aberration at edges, blue-purple fringing |

| 畸变 | 广角桶形/枕形畸变 | slight barrel distortion, wide-angle distortion |
| 呼吸感 | 对焦时画面微缩放 | focus breathing, subtle magnification shift |
| 眩光 | 强光源产生的镜头眩光 | natural lens flare, anamorphic streak |
| 柔焦 | 非锐利区域的柔和过渡 | soft focus fall-off, gentle sharpness gradient |

### 类别三：环境物理类

与拍摄环境相关的瑕疵：

| 瑕疵 | 描述 | 提示词关键词 |
|------|------|-------------|
| 水雾附着 | 水珠/水雾在镜头表面 | water droplets on lens edge, mist on glass |
| 扬尘附着 | 灰尘/沙粒附着镜头 | dust particles on lens, sand grain residue |
| 大气折射 | 远距离拍摄的大气扰动 | atmospheric haze, heat shimmer, distance distortion |
| 体积光 | 介质中的光束可见 | volumetric light rays, god rays through haze |
| 烟残留 | 烟雾在镜头前的残留 | subtle smoke residue, haze in foreground |
| 雨滴 | 雨滴在镜头或保护玻璃上 | rain drops on lens, water streaks |

### 类别四：时间物理类

与物体时间痕迹相关的瑕疵：

| 瑕疵 | 描述 | 提示词关键词 |
|------|------|-------------|
| 风化裂纹 | 表面的风化裂痕 | weathered cracks, aged surface fractures |
| 磨损痕迹 | 使用磨损的边缘 | worn edges, friction marks, patina |
| 氧化变色 | 金属/材质的氧化 | oxidized surface, tarnished metal, green patina |
| 沉积层叠 | 地质/建筑的沉积纹理 | sedimentary layers, geological strata, layered deposits |
| 腐蚀斑点 | 化学腐蚀的痕迹 | corrosion spots, acid etching marks |
| 生物附着 | 苔藓/地衣等生物痕迹 | moss growth, lichen patches, organic colonization |

### 瑕疵注入规则

1. 每个镜头>=3项瑕疵，跨>=2类别
2. 瑕疵必须与场景逻辑自洽（水下场景不应有扬尘）
3. 瑕疵强度与画幅相关：IMAX大画幅下瑕疵更细腻可见
4. 瑕疵不应干扰主体叙事（边缘区域优先）

## 肤质引擎场景版

用于确保场景/物体表面的多层次真实感。分三层检查：

### L1 宏观形态

- 整体轮廓和形状是否物理正确
- 大尺度结构（山体轮廓、海岸线走向、建筑外形）
- 体量感和空间占据感
- 与环境的比例关系

### L2 中观纹理

- 表面纹理（岩层分层、树皮纹路、织物编织）
- 断裂面和接缝
- 材质过渡区域（如岩石到土壤的过渡）
- 中等尺度的磨损和使用痕迹

### L3 微观质感

- 矿物颗粒/晶体结构
- 纤维/毛孔级细节
- 表面光泽度变化（哑光/半光/高光的微妙过渡）
- 微尘/微粒附着

### 检查输出格式

```
肤质引擎（场景版）：
L1 宏观[形态描述] ✅/需要补充[具体缺失]
L2 中观[纹理描述] ✅/需要补充[具体缺失]
L3 微观[质感描述] ✅/需要补充[具体缺失]
```

## 画质锁参数

确保AI生成画面在放大后仍保持细节完整。

### 微观质感描述模板

```
[物体名称]的[具体纹理]清晰[可辨/可见/可触摸]：
- [纹理单元1]：[具体描述，如"每层沉积岩厚度约2-3cm，层间有深色矿物质分隔线"]
- [纹理单元2]：[具体描述]
- [纹理单元3]：[具体描述]
```

### 分辨率保障关键词

```
ultra-detailed IMAX resolution, physically-based rendering, high micro-contrast,
subsurface scattering on organic surfaces, ray-traced reflections,
8K texture detail visible at thread level
```

### 时间稳定性关键词（视频）

```
flicker-free [fps], stable film grain throughout sequence,
no color grade morphing between frames, physically consistent motion,
temporal coherence maintained, no frame-to-frame jitter except intentional gate weave
```

## 去AI感核心策略

### 策略一：引入不完美

AI生成的画面倾向于"完美"。胶片电影的魅力在于不完美：
- 构图微偏：主体不完全居中，地平线微倾
- 焦点微偏：不是所有元素都完美锐利
- 曝光微偏：某些镜头略欠曝或过曝
- 色温微变：同一场景不同镜头色温略有漂移

### 策略二：物理真实感

- 光影逻辑一致：所有镜头的光源方向必须统一
- 材质反射正确：金属反射环境、玻璃有折射、皮肤有次表面散射
- 运动模糊自然：快速运动时有方向性模糊
- 景深物理正确：焦外光斑形状与光圈叶片数相关

### 策略三：避免AI典型痕迹

| AI典型问题 | 修复方法 |
|-----------|---------|
| 手指数量/形态错误 | 避免手部特写，或用道具遮挡 |
| 文字/Logo扭曲 | 画面中避免可读文字 |
| 过度平滑的皮肤 | 加入 "visible skin texture, pores, fine wrinkles" |
| 不自然的对称构图 | 加入 "slightly off-center composition, natural framing" |
| 塑料感的材质 | 加入 "weathered surface, micro scratches, dust particles" |
| 过于鲜艳的色彩 | 加入 "muted tones, slightly desaturated, film color palette" |
| 重复的纹理 | 增加纹理变化的描述 |

## 提示词质感关键词库

### 胶片基础

```
film grain, 35mm film, 65mm film, IMAX 70mm, Kodak Vision3, Fuji Eterna, natural grain structure, organic film texture, analog color rendition, chemical color process
```

### 光影质感

```
soft halation, highlight bloom, natural light falloff, gradual shadow transition, film latitude, warm highlight roll-off
```

### 色彩质感

```
film color palette, muted saturation, warm skin tones, Kodak color science, teal shadows, amber highlights, natural color bleed
```

### 画面质感

```
subtle gate weave, micro film jitter, organic lens imperfection, gentle focus fall-off, natural depth of field
```

### 环境氛围

```
atmospheric haze, dust particles in light beam, subtle smoke, natural lens fog, humidity in air, visible light rays, volumetric light
```

### 去AI感专用

```
visible skin texture and pores, asymmetric facial features, natural hair flyaways, weathered material surfaces, micro scratches and dust, slightly imperfect composition, off-center framing, natural asymmetry
```
