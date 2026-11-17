# narrative：完整电影氛围场景 PNG

由源 `templates/narrative-mode.md` 转化。与 character 模式共享所选画风完全相同的绘画核心；场景扩大概括范围，不提高全画面细节密度。线描平涂仍是线描平涂，粉彩仍是粉彩，不因“电影氛围”自动转为三维写实。

默认 16:9；用户可指定纵向或其他比例。背景必须有真实可读的空间、透视与叙事作用，不能是纯人物抠图、平面渐变或发光壁纸。`transparent_background: false`。

## 完整提示词组合

1. `Story subject and action: <谁在做什么，关键姿态、视线、道具与人物关系>. Setting: <环境、时段、前中后景>. Reference roles: <已选风格主参考名称与ID> = style-only reference; <可选角色图> = identity reference. Do not copy the reference's characters, distinctive props, or staging unless requested.`
2. 依次插入 [Shared quality core](style-anchors.md#shared-quality-core) 与 [已选风格](style-options.md) 文档的 Shared prompt core；不同时插入其他风格核心。
3. `Narrative mode: <目标比例> cinematic composition with a fully painted opaque environment. Establish foreground, middle distance, and background, coherent architecture, credible scale and perspective. Stage figures and sightlines around the main story action; leave enough separation to read their silhouettes. Render essential faces, hands, and the story prop selectively; simplify stone, fabric, and distant objects using the selected style's shapes, edges, and mark-making. Moderate atmospheric perspective and restrained mist must preserve readability.`
4. `Lighting: <可见或有明确空间位置的主光、次光及方向>. Motivated lighting and readable light-dark organization, using the selected profile's depth and shading language. Use low-key Tenebrism for profile 1; preserve flatter shadow shapes in profile 3, softer luminous values in profile 4, and controlled emissive accents in profile 5. No unmotivated rainbow rim lights. The environment supports the characters, with no uniformly sharp ornament, dense particles, noisy stone microtexture, photographic skin, PBR reflections, CGI, plastic materials, flat uniform illumination, or incoherent architecture. Deliver a complete opaque PNG scene, not a transparent cutout.`

青蓝窗光与暖烛光只是合理示例，可依故事变化。环境质量不以装饰数量衡量；远景窗框、烛台、石材都应服从大明暗与故事焦点。不要无故加入参考图中的受害者、幽灵或血迹。

## 固定画质与验收

执行 [固定画质限制](style-anchors.md#固定画质限制)。背景保留必要空间、建筑结构、光源与故事线索，适度简化次要装饰和远景纹理；主体的清晰度与细节层级高于背景。大面积材质平滑连续，低噪点、低颗粒感、无脏污染感、无塑料感，不用密集浮尘、斑点或锐化痕迹冒充电影氛围。


运行 `check_alpha.py --expect opaque --aspect <目标比例>`。RGB PNG 无 Alpha 是正常的不透明成图；RGBA 应实际 Alpha 全为 255。视觉检查空间连贯、建筑尺度、人物互动、主光方向和画风。若实际比例不符，不可声称得到原生目标比例；内置修正一次或交付明确标注限制的结果。不得通过拉伸或裁掉关键叙事对象假装满足比例。

