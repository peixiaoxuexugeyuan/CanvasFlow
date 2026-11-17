# 三级负面提示词体系

## 目录

- [Level 1: 通用避坑](#level-1-通用避坑)
- [Level 2: 风格祛魅](#level-2-风格祛魅)
- [Level 3: 工具纠偏](#level-3-工具纠偏)
- [风格反向禁令](#风格反向禁令)
- [分主题负面词强化](#分主题负面词强化)
- [组装规则](#组装规则)

---

## Level 1: 通用避坑

**必选**。规避AI视频/图像生成的常见技术缺陷。

### 人物与肢体
```
deformed limbs, extra fingers, missing fingers, fused fingers,
mutated hands, malformed ears, asymmetric eyes,
facial artifacts, uncanny valley expression, plastic skin texture,
unnatural body proportions, floating objects attached to body
```

### 画面质量
```
text garble, watermark, signature overlay,
blurry face, out of focus subject, motion blur artifacts,
compression artifacts, banding, color posterization,
low resolution, pixelated, upscaled artifacts
```

### 物理逻辑
```
impossible reflections, shadow direction inconsistency,
floating objects without support, gravity violation (unless intentional),
object scale inconsistency between frames
```

---

## Level 2: 风格祛魅

**必选**。排除诺兰美学中绝对不会出现的元素。

### 色彩与滤镜
```
oversaturated colors, vivid neon colors, high saturation,
beauty filter, skin smoothing, pore removal, airbrushed skin,
Instagram filter, TikTok aesthetic, VSCO preset look,
warm golden hour glow (unless specifically required for scene),
pastel color palette, candy colors,
pale white skin, porcelain smooth skin, plastic skin texture
```

### 风格冲突
```
anime style, cartoon aesthetic, 3D render look, CGI appearance,
Marvel superhero VFX, DC extended universe style,
cyberpunk neon glow, synthwave aesthetic, vaporwave colors,
Japanese清新 (清新日系), Korean drama soft glow,
pixar animation style, video game cutscene aesthetic
```

### 运镜与构图
```
shaky handheld footage, excessive camera shake,
rotating camera without narrative reason, drone selfie angle,
extreme close-up on face (nose/eye filling frame),
Dutch angle without purpose, whip pan, crash zoom,
flat even lighting, soft diffused light on face, no shadow definition
```

### 表演与造型
```
exaggerated facial expressions, overacting, smiling at camera,
flashy colorful costumes, designer brand visible logos,
heavy makeup, glitter, sequins, neon accessories,
comic book pose, superhero landing pose,
laughing out loud, crying dramatically, gritting teeth,
bright colorful costume, shiny material, flashy patterns, cluttered set decoration
```

---

## Level 3: 工具纠偏

**可选**。根据目标AI工具的特定通病补充。

### Seedance 2.5
```
highlights not blown out, shadows not crushed to pure black,
film grain uniform across frame and consistent between frames,
no temporal flickering, no frame-to-frame color shift,
maintain consistent character proportions across all frames
```

### Revo AI
```
consistent facial structure across frames, uniform costume color,
even film grain distribution, no face morphing between frames,
maintain spatial consistency, no object teleporting,
character height consistent across shots
```

### 即梦AI
```
人物比例正常，面部结构统一，
胶片颗粒均匀分布，无闪烁，
服装颜色前后一致，场景空间连贯，
避免过度美化，保持写实质感
```

### 通用工具补充
```
temporal consistency between frames, no morphing artifacts,
stable lighting direction across sequence,
consistent film grain density, no sudden grain changes
```

---

## 风格反向禁令

以下是诺兰美学的底层禁忌，任何场景不可违反(已嵌入Level 2):

1. **禁止慢镜头炫技** -- 诺兰不用慢动作做视觉装饰
2. **禁止无叙事理由的旋转运镜** -- 除《盗梦空间》旋转走廊特定场景
3. **禁止大特写怼脸** -- 五官填满画面的极端特写
4. **禁止大面积纯色块** -- 红/黄/蓝等鲜艳颜色占据画面超过10%
5. **禁止人物正对镜头微笑** -- 诺兰角色不会对着观众笑
6. **禁止夸张肢体动作** -- 手臂挥舞、跳跃欢呼等
7. **禁止满画面填满元素** -- 必须有大面积留白或黑场
8. **禁止数字感高光** -- HDR bloom、光晕扩散等数字后期效果
9. **禁止过度均匀的布光** --  sitcom式平光、环形灯美光

---

## 分主题负面词强化

每个主题在Level 2基础上额外强化的排除项:

| 主题 | 额外排除 |
|------|----------|
| 都市犯罪 | cyberpunk neon, bright warm tones, cartoon crime, comic book aesthetic |
| 时空科幻 | fantasy magic, alien creatures, space opera, flashy sci-fi costumes |
| 宏大史诗 | pastoral photography, cartoon space, saturated planets, cheerful adventure |
| 心理悬疑 | bright warm tones, clear imagery, comedy, romantic soft focus |
| 历史传记 | beauty filter, skin smoothing, melodramatic acting, idol drama |
| 日常写实 | indie film filter, web drama look, sitcom lighting, music video |

---

## 组装规则

### 标准组装顺序
```
[负面提示词]
{Level 1 通用避坑词},
{Level 2 风格祛魅词},
{主题额外排除词},
{Level 3 工具纠偏词 - 如适用}
```

### 按强度调整
- L1: Level 1 + Level 2(精简版) + Level 3
- L2: Level 1(完整版) + Level 2(完整版) + 主题强化 + Level 3
- L3: Level 1(完整版) + Level 2(完整版+风格禁令) + 主题强化 + Level 3

### 长度控制
- 总负面词不超过提示词总长度的30%
- 优先保留对当前场景影响最大的排除项
- 工具纠偏词根据实际使用的工具选择，不使用的工具不添加
