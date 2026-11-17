`sub_md_02_vfx_layering.md`**（三层特效与渲染锁）**

# 附MD 2 | 三层特效与渲染锁

## #怎么做

### 一、 三层景深特效叠加（防止特效扁平）

- **前景层（Foreground）**：贴近镜头的快速飞掠粒子/速度线（带运动模糊），30%-50% 透明度。
- **角色层（Character）**：从角色身上散发的核心能量（气焰、符文），100% 不透明。
- **背景层（Background）**：大范围环境改变（天空变色、空间碎裂），60%-80% 透明度。

### 二、 渲染参数锁（MAPPA 风格）

- 强制正向词：`Japanese anime style, MAPPA studio style, sharp clean line art, minimal motion blur, high-contrast blacks with deep purples/blues, cel shading.`
- 强制负向词：`3D render, realistic, western cartoon, flat colors, low quality, text, watermark.`