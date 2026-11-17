# Nano Banana 中英双语提示词

这些是供图像编辑使用的自然语言指令，不是API或原生参数声明。先上传/选定原图再使用。花括号是作者填充槽位，最终交付时根据观察替换；无图时明确标为通用模板。中英两版的区域、允许项、锁定项和禁止项必须一致，不在英文版擅自添加 cinematic、8K、hyper-detailed 等扩张词。

## 通用主模板

### 中文
以提供的原图为唯一构图和人物身份基准，执行{模式及目的}。保持画幅、构图、相机视角、透视、主体位置、轮廓、姿势、身体比例、表情、视线、面部骨骼和五官位置不变。保持服装版型、接缝、配饰、图案文字、背景物体关系、原画风、主光方向与色彩关系。尤其保留{本图身份和结构锚点}。
只处理{区域及边界}内已确认的{具体问题}，通过{局部修复动作}使其达到{可见验收标准}。保留{本区域正常纹理}及原图分辨率下的自然细节。其余区域保持原样。
不要换脸、美颜、改年龄、重塑骨骼、改变肤色关系、磨平自然纹理、增加伪毛孔或锐化光晕。不要新增物体、重设计服装、改变光照布局或整体风格。若某项清理会改变结构或无法区分真实纹理，请保留该处，只完成确定且必要的局部修复。

### English
Use the supplied original image as the sole reference for composition and depicted identity. Apply {mode and purpose}. Preserve the aspect ratio, framing, camera angle, perspective, subject placement, silhouette, pose, body proportions, expression, gaze, facial bone structure, and facial feature positions. Preserve garment construction, seams, accessories, patterns and text, spatial relationships in the background, the original visual style, key-light direction, and color relationships. In particular, retain {image-specific identity and structural anchors}.
Edit only the confirmed {specific defects} within {region and boundaries}, using {local repair action} to achieve {visible acceptance criterion}. Retain {valid texture in this region} and natural detail at the original image resolution. Leave all other regions unchanged.
Do not replace or beautify the face, alter apparent age, reshape bones, change skin-tone relationships, erase natural texture, or add synthetic pores or sharpening halos. Do not add objects, redesign clothing, change the lighting arrangement, or restyle the image. If cleaning would alter structure or if a detail cannot be distinguished from valid texture, preserve that detail and perform only the certain, necessary local repairs.

## 模式插入语句（只选适用项）

**模式A / Mode A**
中文：仅降低指定区域的异常颗粒、重复伪纹理和锐化光晕；保留真实边缘、合理细节、景深和原有艺术性颗粒，不作全局模糊或增锐。
English: Reduce only anomalous speckles, repeated synthetic texture, and sharpening halos in the specified region. Preserve real edges, valid detail, depth of field, and intentional artistic grain. Do not apply global blur or sharpening.

**模式B / Mode B**
中文：仅修复指定皮肤区域的均匀塑料高光和蜡像平滑感，保留自然毛孔、细纹、局部色差与原光照体积；只修改材质表现，不改变面部骨骼、五官、身份或年龄。
English: Repair only the uniform plastic highlights and waxy smoothness in the specified skin region. Retain natural pores, fine lines, local color variation, and the volume defined by the original lighting. Change surface appearance only, preserving facial bones, facial features, depicted identity, and apparent age.

**模式C / Mode C**
中文：仅优化指定材质的粗糙度观感、反射连续性和局部阴影过渡，保持材质种类、几何形态、原画风及主光方向；不添加泛光、强AO、景深或全局调色。
English: Refine only the apparent roughness, reflection continuity, and local shadow transitions of the specified material. Preserve material type, geometry, original visual style, and key-light direction. Do not add bloom, strong ambient occlusion, depth of field, or global color grading.

**可选UE5视觉参照 / Optional UE5 visual reference（仅明确要求时）**
中文：以高质量UE5实时渲染的材质可信度为视觉参照，但保持原图的风格与灯光设计，不改成游戏角色或塑料表面。
English: Use the material credibility of high-quality UE5 real-time rendering as a visual reference while preserving the original style and lighting design. Do not turn the subject into a game character or give surfaces a plastic appearance.

**用户指定东亚人物时的身份保护 / Identity preservation for a user-described East Asian subject**
中文：保留原图人物独有的眼睑、眼距、鼻梁、颧骨与下颌比例及自然不对称；不要加深眼窝、增高鼻梁、放大眼睛、削窄下颌或套用统一脸型。
English: Preserve this individual's original eyelids, eye spacing, nasal bridge, cheekbone and jaw proportions, and natural asymmetry. Do not deepen the eye sockets, raise the nasal bridge, enlarge the eyes, narrow the jaw, or impose a standardized face shape.

## 第二轮局部纠偏模板

中文：图1为原图结构基准，图2为待纠偏结果。只修正图2中{区域}的{已确认偏差}，使{锚点或材质}回到图1的状态。保留图2中已经通过验收的{改进}及其他区域。不继续增加细节，不再次全局重绘；若身份或骨骼已整体漂移，放弃图2，回到图1仅执行{缩小后的修改}。
English: Image 1 is the original structural reference; image 2 is the result to correct. Fix only the confirmed {deviation} in {region} of image 2, restoring {anchor or material} to its state in image 1. Retain the accepted {improvements} in image 2 and leave other regions unchanged. Do not add further detail or regenerate the whole image. If identity or bone structure has drifted throughout, discard image 2 and return to image 1 for only {reduced edit scope}.

只有目标工具支持多图并且角色已清楚标注时，使用上述双图版本；否则以原图重新开始局部编辑，不假称支持多图权重。禁止项写在同一自然语言提示中，不假设存在专用负面提示词栏。
