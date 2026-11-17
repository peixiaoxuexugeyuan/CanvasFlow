# 所有选项共享的质量与参考规则

先按 [风格菜单](style-options.md) 确定画法，再读该风格文档。character 与 narrative 是输出用途；它们不决定线描、厚涂、粉彩或光效的画法。同一作品组在两种输出用途下保持同一个风格核心。

## 优先级

1. 用户明确的主体、身份和已选画风优先。新人物的身份图约束脸、服饰、肢体、装备，不自动成为画风图。
2. 所选画风的主参考决定绘画语言。选项1默认使用原有 [施特拉德图](../assets/style-reference-strahd.webp)，维持原版最高风格优先级；用户选其他选项或明确指定图库主图后，以该图为本次风格主锚，不混入施特拉德的立体厚涂去覆盖线描平涂。
3. 一般传一张主风格图；确需补充才加同组选项的一张辅图。跨组借色必须明确仅借配色，并保持一个主画法。不要一次输入整套图库制造平均混合画风。
4. 图库默认为 `style-only reference`；同一张图需要兼顾身份时，明确分别保留的身份特征与画法。原图的角色、血迹、武器、王座、背景、花纹和姿态均不是自动移植内容。

## 固定画质限制

以下为用户新增的固定限制，适用于全部五种画风、首次生成与后续修正：

> 透明图层，画面干净通透，整体细节克制且有层次，主体清晰，背景细节适度简化。保持大面积材质平滑、连续自然，减少无意义的碎小纹理、颗粒、斑点和随机锐化痕迹。低噪点，低颗粒感，无脏污染感，无塑料感，电影级干净画质。

- **透明图层**：character及独立人物素材必须是真正Alpha透明PNG，轮廓与半透明材质完整，无白底、假棋盘格、底色污染或不透明雾板。narrative按其用途保留完整实景，背景适度简化，不把透明人物模式与完整场景模式混淆。
- **细节层级**：脸、眼神、手和关键身份／叙事道具清楚；主要衣料与形体使用连续大面；次要装饰与远景进一步概括。背景的清晰度、纹理密度与局部反差服从主体，不平均铺满细节。
- **材质连续**：大面积皮肤、布料、石材等平滑、连续、自然，保留有形体依据的转折与笔触；平滑不等于磨皮、重度模糊、蜡质表面或镜面抛光。保持既定画法的边缘和自然笔触。
- **噪点与瑕疵限制**：减少无意义的碎小纹理、颗粒、斑点、脏污覆盖、随机锐化痕迹及边缘光晕。即使参考图带密集纸感、干笔颗粒或磨损，也只保留有组织的绘画笔触，输出仍以低噪点、低颗粒感为标准。
- **电影级干净画质**：主体明确、色面干净、暗部有层次、空间通透；不引入照片级皮肤、塑料高光或3D/PBR材质。该词描述视觉目标，不代表未经验证的分辨率、HDR或技术认证。

## Shared quality core

将以下质量核心与**选中的一个风格文档**的 Shared prompt core 一起使用。此处不强制所有选项使用厚涂、低饱和或Tenebrism。

> Create a finished two-dimensional hand-drawn or hand-painted Gothic dark-fantasy illustration in the selected reference's specific visual language. Preserve the requested identity, silhouette, equipment, and anatomy; for nonhuman subjects follow the supplied creature design rather than forcing human proportions. Keep the main subject clear and visually dominant, with restrained, layered detail concentrated on meaningful facial, hand, identity, and story features. Simplify secondary background detail while preserving readable space and story context. Keep large material areas smooth, continuous, and naturally shaped, with coherent broad color planes and intentional form-following marks. Maintain clean, airy readability, clean color separation, layered shadows, very low noise, and very low grain. Reduce meaningless tiny textures, speckles, spots, dirty contamination, random sharpening marks, and sharpening halos. Aim for cinematic cleanliness of image quality while retaining the selected drawing or painting language, natural brushwork, and essential material structure. For character or isolated-asset output, use a genuinely transparent alpha layer with clean intact edges; for narrative output retain its complete environment with simplified secondary surfaces. Preserve only purposeful texture, without smoothing away natural brushwork or making surfaces waxy, glossy, or plastic. Exclude 3D renders, PBR/CGI material response, plastic surfaces, photographic skin pores, procedural microtexture, random decorative speckles, excessive particles, oversharpening, dirty overlays, extraction smears, and corrupted transparency artifacts.

## 画法、配色与题材分开

- 选项1的体积与暗部、选项2的概括色面、选项3的细线与平涂、选项4的干笔与柔光、选项5的受控发光，分别是需要保留的绘画结构。
- 青蓝/暖橙、毒绿/洋红、红金、粉紫都可依作品需要改变，不因换色就误称换画风。高彩也必须有主次与安静的大面。
- 原图中可见的颗粒、纸感、斑点只提取其中有组织的笔触；不复制噪声或压缩痕迹。[R04](../assets/art-library/mother-lorinda-transparent.webp) 的隐藏RGB有横向色带，正确Alpha合成时不显示，禁止丢弃Alpha后当普通RGB使用；它还保留脚下地面，因此仅作造型辅助，不作为纯人物透明质量范例。
- “电影感”要求构图、人物关系、空间与光线叙事；不要求照片级材质。发光选项也必须是画出来的光，不用均匀霓虹描边替代体积。

使用 [质量清单](qa-checklist.md) 检查所选画法。自动PNG/Alpha检查不判断线描或厚涂画得是否准确。
