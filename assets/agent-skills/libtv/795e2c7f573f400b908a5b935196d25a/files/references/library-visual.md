# 资料库：色板、摄影机、微缩、光影

## 二十一、场景化资料库

本阶段保留所有资料库原文，不删减。Skill 封装阶段再将各模块物理拆分为 references 文件。

### 资料库调用索引

| 条件 | 调用模块 |
|---|---|
| 色彩一致性 / 色板资产 | @COLOR_PALETTE |
| 纯摄影机运动 | @MOVEMENT |
| 复杂动作 / 走位 / 调度 | @BLOCKING |
| 台词 / 声音叙事 | @AUDIOVISUAL |
| 摄影机与镜头风格 | @CAMERA |
| 微缩模型摄影 | @MINIATURE |
| 特殊视角 | @ANGLE |
| 移焦 / 焦点策略 | @FOCUS |
| 多镜头衔接 | @EDIT |
| 情绪外化 | @EMOTION |
| 光影叙事 | @LIGHTING |
| 音效设计 | @SOUND |
| 节奏高潮 | @RHYTHM |
| 转场 | @TRANSITION |
| 负面约束 | @NEGATIVE |
| 手法重复替换 | @ALTERNATIVES |

### @COLOR_PALETTE：色板资产生成与引用


此模块用于在资产准备阶段生成色板参考图。生成后，在分镜脚本的"参考图引用（色彩）"行中像引用角色图一样引用。


**色彩决策逻辑**（每次生成色板时明确选定一种）：

- **基础提取**：忠于参考图原色，不偏移、不增强。

- **剧情叙事**：根据剧情情绪选色，允许冷暖对比和氛围强化。

- **抽象感觉**：脱离物理限制，将感受转化为色彩。


**色板参考图提示词模板**（作为 promote 输入交给 `generate_image_v3` 使用）：

```

生成一张独立的电影级色板参考图，16:9 横向宽屏，网格化纯白背景且无网格线。


布局严格为纯色块横向排列：

- 5-7 个纯色色块，主色占 60% 面积，辅色 30%，点缀色 10%。色块边缘清晰，无渐变融合。

- 不得出现任何文字、标签、HEX 色码、场景、人物、装饰或画面内容。


色彩决策指令：【忠于参考图原色 / 服务于剧情情绪 / 传达抽象感觉】

影视色调参考：【1-3部影视作品名 + 对应色调特征】

整体氛围：【用一句话描述，如：冷峻疏离，阴影带青，高光暖黄，柯达5219胶片特性】


（若为系列色板，请加入以下约束：参照上一张色板"[名称]"，保留其暗部基调，仅将辅色和点缀色向[具体偏移方向]偏移，生成全新独立图，切勿拼贴。）

```


**使用流程**：

1. 根据剧本情绪或段落基调，调用本模块完成色彩决策并替换【】内容。

2. 将完整色板提示词 promote 给 `generate_image_v3`：`ai_model: Lib Image`，`aspect_ratio: 16:9`，标准画质 2K；生成后命名为 `@色板_段落名`。

3. 在分镜脚本中引用：`@色板_Act1（本段落色彩基调板）`。

### @CAMERA：专业摄影机与镜头选择


**风格化摄影机系统**


| 摄影机 | 风格化特征 | AI执行锚点 |

|--------|-----------|-----------|

| ARRI ALEXA 65 | 大画幅、极高宽容度、柔和肤色 | `shot on ARRI ALEXA 65, large format, exceptional dynamic range, smooth highlight roll-off, natural skin tones` |

| ARRI ALEXA 35 | REVEAL色彩科学，更高饱和度 | `shot on ARRI ALEXA 35, REVEAL color science, rich saturation, neutral tonal balance` |

| ARRI ALEXA Mini LF | 大画幅、经典ARRI色彩 | `shot on ARRI ALEXA Mini LF, large format, classic ARRI color, soft skin tones` |

| ARRI ALEXA 235 | 轻量化大画幅，手持/特殊机位 | `shot on ARRI ALEXA 235, lightweight large format, handheld intimacy, documentary realism` |

| SONY VENICE 2 | 高分辨率、16档动态范围 | `shot on SONY VENICE 2, high resolution, accurate color, wide dynamic range` |

| RED V-RAPTOR | 锐利影像、高速摄影 | `shot on RED V-RAPTOR, high resolution, sharp image, flexible color grading` |

| Panavision Millennium DXL2 | 大画幅、暖调、独特眩光 | `shot on Panavision Millennium DXL2, large format, warm tone, unique flaring` |

| ARRI ARRIFLEX 416 | Super 16mm胶片，颗粒感 | `shot on ARRIFLEX 416, Super 16mm film stock, organic grain structure, nostalgic texture` |

| Bolex H16 | 16mm发条驱动，抖动感 | `shot on Bolex H16, 16mm film, spring-wound, unsteady handheld, voyeuristic intimacy` |

| ARRI 765 | 65mm胶片，极致分辨率 | `shot on ARRI 765, 65mm film stock, extreme resolution, ultra-shallow depth of field, rich color depth` |


**风格化镜头组**


| 镜头组 | 风格化特征 | AI执行锚点 |

|--------|-----------|-----------|

| Atlas Orion 变形宽银幕 | 2x挤压比，金色眩光 | `Atlas Orion anamorphic lenses, 2x squeeze, golden horizontal flares, oval bokeh` |

| Cooke Panchro/i Classic | 暖调、低反差、经典"Cooke Look" | `Cooke Panchro/i Classic lenses, warm, low contrast, classic Cooke Look` |

| ZEISS Supreme Prime Radiance | 可控蓝金眩光 | `ZEISS Supreme Prime Radiance, controllable blue and golden flares, high resolution` |

| Canon K35 | 暖调琥珀眩光 | `Canon K35 lenses, warm amber flares, soft spherical aberration, vintage cinema feel` |

| Leitz M 0.8 | 复古、低反差、球面像差柔焦 | `Leitz M 0.8 lenses, vintage, low contrast, spherical aberration glow, dreamlike rendering` |

| Lomography Petzval | 旋转焦外、极度锐利中心 | `Lomography Petzval lens, swirly bokeh, sharp center, edge distortion, surreal and psychedelic` |

| Lensbaby Velvet | 柔焦、发光高光 | `Lensbaby Velvet lens, soft focus, glowing highlights, low contrast, painterly rendering` |

| Hawk V-Lite 变形宽银幕 | 1.3x挤压比，蓝色眩光 | `Hawk V-Lite anamorphic lenses, 1.3x squeeze, subtle anamorphic character, unique blue flares` |

| Sirui 变形宽银幕 | 1.33x挤压比，轻量化 | `Sirui anamorphic lenses, 1.33x squeeze, lightweight, modern anamorphic look` |

| Vantage MiniHawk | 轻便，近焦极佳 | `Vantage MiniHawk anamorphic, optimized for digital, lightweight, close focus` |

| Angenieux Type EZ | 变焦，法兰距可换 | `Angenieux Type EZ zoom, flexible focal length, quick reframing, documentary efficiency` |

| Fujinon Premista | 大画幅变焦，呼吸效应极低 | `Fujinon Premista zoom, large format, prime-like optical quality, minimal breathing` |


**搭配逻辑**


| 流派/风格 | 推荐摄影机 | 推荐镜头组 |

|----------|-----------|------------|

| 复古胶片感 | ARRIFLEX 416/Bolex H16 | Cooke Panchro/i Classic/Canon K35 |

| 宏大史诗 | ARRI 765/Panavision DXL2 | Atlas Orion/Hawk V-Lite |

| 现代科幻/动作 | RED V-RAPTOR/SONY VENICE 2 | ZEISS Supreme Prime Radiance/Hawk V-Lite |

| 迷幻/恐怖 | ARRI ALEXA Mini LF | Lomography Petzval/Leitz M 0.8 |

| 独立/纪录片 | ARRI ALEXA 235/Bolex H16 | ARRI Ultra Prime/Angenieux Type EZ |

| 浪漫/爱情 | ARRI ALEXA 35 | Cooke S4/i/Lensbaby Velvet |

### @MINIATURE：微缩模型摄影技法


**光圈策略**


| 光圈 | 景深效果 | AI执行锚点 |

|------|----------|-----------|

| T/2.8-T/4 | 浅景深，奶油散景 | `wide open, T/2.8, razor-thin depth of field, creamy bokeh` |

| T/5.6-T/8 | 中等景深 | `T/5.6, moderate depth of field, subject sharp, background softly visible` |

| T/11-T/16 | 深景深 | `T/11, deep depth of field, everything in sharp focus` |


**布光技法**


| 技法 | AI执行锚点 |

|------|-----------|

| 交叉布光 | `cross-lighting, warm and cool light sources from opposing angles, enhanced texture` |

| 顶光+底部反弹 | `overhead soft key light with subtle bounce fill from below, soft shadows` |

| 局部点光源 | `miniature practical lights integrated into set, localized warm pools of light` |

| 黑旗控光 | `controlled light with flags and cutters, precise shadow edges` |

| 体积光 | `volumetric lighting, visible light rays through haze, atmospheric depth` |

| 书式布光 | `book lighting technique, light bounced off large diffusion frame, extremely soft and even illumination` |

### @LIGHTING：光影设计


**控光附件**


| 技法/附件 | AI执行锚点 |

|-----------|-----------|

| 柔光布/柔光箱 | `diffusion filter, softbox, soft wraparound light` |

| 反光板/米菠萝 | `bounce board fill, subtle shadow lift` |

| 黑旗/遮光片 | `flagged light, precise light cut, controlled spill` |

| 格栅/蜂巢 | `grid spot, honeycomb, controlled beam angle` |

| 纱网/Cutter | `scrim, net, graduated shadow` |

| 调光台/调光器 | `dimmer, intensity control, fading light` |

| 色彩滤镜/色纸 | `CTO gel, CTB gel, color correction filter` |


**布光技法**


| 技法 | AI执行锚点 |

|------|-----------|

| 三点布光 | `three-point lighting, key, fill, and rim light, classic cinematic setup` |

| 伦勃朗布光 | `Rembrandt lighting, triangle of light under the eye, dramatic and dimensional` |

| 派拉蒙布光 | `Paramount lighting, butterfly shadow under nose, glamorous and flattering` |

| 分割布光 | `split lighting, face half in light half in shadow, internal conflict and tension` |

| 逆光剪影 | `silhouette lighting, subject backlit, featureless dark figure against bright background` |

| 脚光 | `underlighting, light from below, inverted shadows, eerie and unsettling` |
