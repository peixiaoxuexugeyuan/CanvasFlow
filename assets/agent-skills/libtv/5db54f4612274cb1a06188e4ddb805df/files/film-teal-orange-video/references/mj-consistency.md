# MJ 提示词稳定约束

## 当前目标与边界

![用户满意的第一张 MJ 图片](../assets/mj-approved.png)

用户满意此图。第二张（普通蓝天、硬朗细节）和第三张（深蓝天空、强反差与插画观感）仅作反例，不混入正向参考。编写 MJ 提示词时仅使用自然语言，不添加或自动修改 MJ 参数。用户明确要求生成时，可使用宿主环境提供的生成工具。纯提示词只能降低漂移，不能保证每次一致；未在 MJ 实测时明确说明。

## 用户认可的跨题材效果

![用户认可的过山车效果](../assets/approved-roller-coaster.png)

此图已获用户认可，作为将主参考色调迁移到其他题材的辅助样例；不强制每个题材使用相同轨道或构图。

## 锁定色彩与质感

- 天空：浅灰青绿、带绿色倾向的灰绿松石色，明亮且饱和度适中偏低；不是普通钴蓝、深海军蓝或荧光青。大片连续天空，少量细薄白云，不使用高对比云团。
- 暖色：陶土橙、旧砖橙、暖象牙白、米杏地面；真实肤色，不用金色夕阳解释全部暖色。
- 层次：柔和中低反差，温润中间调，暗部有密度但可读，高光不过曝；写实材质，中等细节与轻微光学软感。避免“ultra detailed、razor sharp、HDR、dramatic lighting、epic、hyperrealistic”叠加导致锐化、浓色或戏剧光线。
- 胶片：细密颗粒；胶片光晕仅在确实存在强高光处轻微出现，不为光晕新增太阳、灯光或亮斑。
- 可用固定英文色调段：`pale muted green-cyan sky with a soft gray-turquoise cast, sparse delicate white clouds, restrained terracotta orange and warm ivory surfaces, soft apricot-beige ground, low-to-moderate saturation, gentle tonal contrast, luminous warm midtones, readable soft shadows, smoothly rolled highlights, natural material detail, fine analog grain and slight optical softness, very subtle localized orange-red halation only at strong highlight edges`。

## 锁定构图的方法

保持“一主体，最多两主体”的规则。人和其正在使用的装置可作为一个叙事整体，人物必须是唯一人物，不能扩展为人群。背景帐篷低对比、部分可见，不能成为第三焦点。

每张只指定一个主构图，写明：机位／景别、主体位置与大小、对角线方向、天空或其他留白的位置与大致比例、背景物件数量与位置。这些比例是视觉目标，不是模型保证执行的精确布局。

复现本图时：竖幅、低机位、中远景；大炮从左下向画面中上部倾斜，炮口靠近中央，单个人物在炮口上方，人物只占较小面积；上半部和右上方形成连续天空留白，天空约占画面一半。右下只有一顶低对比暖白帐篷。图一左上有遮棚形成边缘框景，它不是必选元素；复现同一画面时允许一块简单遮棚，其他题材不默认复制。没有用户要求时不反转对角线、不改成充满画面的极端广角近景。

换题材时只换主体和相应构图段，固定色调段保持原文。同一组图不随机替换胶片型号、镜头、光线时间和同义色词；不同时要求“饱满浓郁”和“低饱和”、不同时要求“中性白”和“全局金黄”。

## 人间大炮：中文成稿

竖幅写实胶片摄影，明亮白天的安静复古马戏场，一门陶土橙与暖象牙白的人间大炮，唯一一位戴深色头盔的表演者坐在炮口上方，人物与大炮组成一个清楚的视觉主体。低机位中远景，大炮从画面左下斜向中上方，炮口位于中央附近，人物较小但清楚，完整保留大炮主要形体，避免贴脸近景和夸张广角。明亮的浅灰青绿天空占画面约一半，在上方与右上方保留大片连续留白，仅有少量细薄柔和白云。右下方只有一顶低对比暖白马戏帐篷，地面为米杏色，背景简洁无其他人物和设施。天空带柔和灰绿松石色倾向，主体保持克制陶土橙、旧砖橙与暖象牙白，中低饱和度，柔和中低反差，温润明亮中间调，阴影柔和可读，高光平滑。真实涂装、金属和布料细节，轻微光学软感，细密胶片颗粒，仅强反光边缘带极轻微红橙胶片光晕。避免普通钴蓝或深海军蓝天空、浓重乌云、荧光色、黄色云层、强暗角、HDR、过度锐化、繁复机械配件、夸张锈蚀、插画与 3D 渲染质感。

## MJ 英文成稿（不附参数）

Vertical live-action analog photograph of a quiet vintage circus in bright daylight. A single terracotta-orange and warm-ivory human cannon, with exactly one helmeted performer seated just above its muzzle, forming one cohesive focal subject. Low-angle medium-wide view. The cannon rises diagonally from the bottom left toward the upper middle; its muzzle is near the center and the performer is small but clearly readable. The principal shape of the cannon remains visible, with natural perspective. Pale muted green-cyan sky with a soft gray-turquoise cast occupies about half the frame, leaving continuous open space above and to the upper right, with only sparse delicate white clouds. One subdued warm-ivory circus tent sits in the lower-right background, above soft apricot-beige ground. Restrained terracotta orange and warm ivory surfaces, low-to-moderate saturation, gentle tonal contrast, luminous warm midtones, readable soft shadows and smoothly rolled highlights. Natural painted metal and fabric detail, fine analog grain and slight optical softness, very subtle localized orange-red halation only at strong highlight edges. A simple uncluttered scene without crowds, extra rides, dense machinery, dramatic clouds, cobalt-blue or dark navy sky, neon colors, yellow clouds, heavy vignetting, HDR sharpening, exaggerated rust, illustration or CGI rendering.

## 验收与调整

按五项筛选：天空是灰青绿而非蓝；暖色为陶土橙而非鲜红或金黄；反差柔和且没有死黑；主体数量与位置符合构图段；材质真实但没有高锐化或插画感。只调整不合格的一项提示词，不同时增加所有风格词。图一原始提示词未提供，不能断言图二图三漂移的模型内部原因，也不能声称已获得稳定出片率。
