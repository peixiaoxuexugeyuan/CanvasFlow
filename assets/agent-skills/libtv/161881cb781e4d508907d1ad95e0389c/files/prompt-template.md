# 暗黑奇幻设定图 · 提示词模板

---

## 模式A：标准三视图（正面/侧面/背面）

```
皮克斯3D动画电影渲染，PBR物理材质，SSS次表面散射皮肤，6头身卡通比例，圆润卡通形体，暗黑童话基调，均匀平光照明，干净纯粹灰色背景，角色设计参考图排版，3D动画电影剧照质感，低饱和情绪基调，胶片颗粒感。三个全身视图水平排列：正面、侧面、背面，同一个角色。{{角色描述}}。--ar 16:9
```

---

## 模式B：三联设定图（左衣服无头正面 / 中背面全身 / 右头部正脸特写）

```
皮克斯3D动画电影渲染，PBR物理材质，SSS次表面散射皮肤，6头身卡通比例，圆润卡通形体，暗黑童话基调，纯灰色无缝背景，均匀平光照明。画面水平三等分：
左侧——无头人体模型穿着{{服装描述}}正面展示，肩部以上自然收住没有头，有手有脚，完整展示服装正面剪裁细节；
中间——人物背面全身站立图，有头，可见{{发型描述}}背面，身穿同款服装背面；左侧和中间是同一个角色，比例一致，脚底同线；
右侧——角色头部正面特写，完全展示整个头部不被画面边角裁切，正脸直视镜头，均匀柔和平光照明，脸部无阴影无高光无特效，清晰干净展示面部特征和发型。
低饱和情绪基调，胶片颗粒感。{{角色面部描述}}。--ar 16:9
```

---

## English Version（模式A）

```
Pixar 3D animated movie render, PBR materials, SSS subsurface scattering skin, 6 heads tall cartoon proportions, rounded cartoon form, dark fairy tale tone, even flat lighting, clean neutral gray background, character design reference layout, 3D animated movie still, low saturation moody tone, film grain. Three full-body views side by side: front view, side profile, back view, same character. {{character description}}. --ar 16:9
```

---

## 负面词

```
2D illustration, hand-drawn, cel shading, anime, photorealistic, real human proportions, live action, dramatic chiaroscuro, strong side lighting, rim light, volumetric fog, deep shadows, bright cheerful, pastel colors, text, watermark, logo
```

---

## 调用参数速查

| 项 | 值 |
|---|---|
| 工具 | `image_gen`（纯文生图）或 `image_edit`（带参考图保持角色一致） |
| `width` × `height` | `2048 × 1152`（16:9） |
| `model_version` | `seedream_5.0_pro` |
