# character：真正透明的纯人物 PNG

由源 `templates/character-mode.md` 转化。先选画风并读取其说明与共享质量规则；下面仅规定人物模式。透明立绘继承已选画风，不能因为输出模式变化而改画成光滑游戏模型；选项3保留线描平涂，选项4保留克制干笔。

## 取景

| 用户用途 | 默认比例 | 边界要求 |
| --- | --- | --- |
| full-body 全身立绘（未给取景时默认） | 9:16 | 头发、脚、披风、武器完整；四周有少量透明余量 |
| half-body 半身/腰部以上 | 3:4 | 头发、肩膀、姿态与主要手势完整；仅下方允许合理腰部裁切 |
| bust 头像/胸像 | 1:1 | 头部完整，可按取景截断下方胸部；不是圆形 token |

用户比例与取景优先。主体充分占据画幅，通常高约 80%–95%，作为视觉目标而非自动拒绝阈值；手、饰件和动作需要空间时可调整。避免悬空肢体、无支撑扭转、手掌附着错误和与服装融合的武器。

## 完整提示词组合

按顺序合并以下段落，填入实际要求；不得把占位内容原样发送给工具：

1. `Subject / identity: <用户外观、衣服、装备、动作、性格；若有身份图，明确保留哪些设计> . Reference roles: <已选风格主参考名称与ID> = style-only reference, not the identity or composition to copy; <可选身份图> = identity reference.`
2. 依次插入 [Shared quality core](style-anchors.md#shared-quality-core) 与 [已选风格](style-options.md) 文档的 Shared prompt core；不同时插入其他风格核心。
3. `Character mode: <full-body / half-body / bust>, <目标比例>, isolated single character. Credible anatomy, natural weight and joint placement, readable intentional hand pose. Keep all required hair, shoulders, cape, accessories, and weapons intact. Emphasize the face and hands; use the selected profile's edge, stroke, and shading language consistently on the figure, keeping large fabric areas quiet and avoiding all-over tiny embroidery.`
4. `Output a PNG with a genuinely transparent alpha background. Do not paint a room, floor, cast shadow, wallpaper, glow backdrop, gradient, white or colored ground, or checkerboard. Keep a clean natural silhouette, fine hair and translucent accessories where present, no background-colored fringe. Only the intentional framing cut at <若适用，腰部/胸部下方> may touch the bottom boundary. No extra fingers, fused hands, floating jewelry, photographic skin, 3D/PBR, plastic surfaces, excessive microtexture, oversharpening, or noisy grain.`

工具必须设置 `transparent_background: true`。冷暖光可以画在人物表面；不能为了表现参考图的环境光添加不透明背景或云雾板。即使参考图自带房间、植物、光雾、地面或透明残影，也只迁移已选画法；`mother-lorinda-transparent.webp` 不能作为透明边缘验收范例。

## 固定画质与验收

执行 [固定画质限制](style-anchors.md#固定画质限制)，与真实Alpha一起验收。人物主体清晰、脸手与关键装备有层次；衣料、皮肤等大面平滑连续，减少无意义细碎纹理、斑点、颗粒和随机锐化。透明画布中不补背景纹理；不得通过磨皮、塑料高光或重度模糊实现“干净”。


运行 `check_alpha.py`，确认实际 PNG、非空主体、明显的全透明背景、可见实体，不能只有一个透明像素或仅将不透明图转换为 RGBA。检查发际、衣料间隙、武器、披风尖角的完整性。边缘半透明像素是正常抗锯齿，不能把整个人物降透明来制造“透明成功”。脚本不能识别假棋盘格或检查手指，仍需视觉检查。若边缘有异常底色，使用内置图像编辑定向修正一次并保留身份。

