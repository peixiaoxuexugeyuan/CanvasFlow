# 1 · 经典明暗油画

本选项默认最高优先级风格图为 [style-reference-strahd.webp](../../assets/style-reference-strahd.webp)，保留原版默认风格。若用户明确点名同组的Azalin、哈肯或拉迷亚，则以点名图为本次主图；下面的施特拉德观察提供基础对照。每次任务实际看主图，不能仅凭“哥特”或配色标签推测。人物和场景共享下面的核心；模式只改变主体、取景与背景交付。同组辅助图可提取Azalin的冷灰体积、哈肯的低调暖灯、拉迷亚的紫幕与灵光；不必同时传入，也不复制这些角色。

## 原图可见证据与转化

| 可见位置 | 绘画观察 | 生成约束 |
| --- | --- | --- |
| 中右侧贵族面颊、鼻梁、下颌和举杯手 | 灰绿、青灰、暖赭的少量相邻色面塑造骨相；鼻梁亮面窄，眼窝和颧下归入连续暗面 | 半写实骨骼与透视可信，用明暗色块塑造体积，不复制摄影皮肤、毛孔或平滑塑料表面 |
| 披风肩部、胸前与腿部衣褶 | 短而明确的斜向亮笔顺着褶皱行进，胸腹和腿部保留宽阔深色块 | 笔触跟随形体；衣料先有连续大面，再有少量折线与边缘亮笔，不铺满细碎纹理 |
| 右侧烛台与左侧幽灵 | 暖橙烛光有实际来源，青蓝光从左照亮手与轮廓，光源间保留大面积深暗 | 巴洛克明暗对照 / Tenebrism，光向一致，暗部仍有颜色和层次，冷暖服务于体积和叙事 |
| 贵族脸、手、杯口与胸针 | 清晰程度高于胸前纹饰、远处画像和前景躯体 | 焦点集中于脸、眼神、手和关键身份/叙事道具，次要材质以更宽的笔触概括 |
| 王座外沿、深色袖口与披风阴影 | 硬亮边与软边、消失边缘交替，暗部轮廓融入环境 | lost-and-found edges；人物透明输出中内部仍保持这种边缘层级，外轮廓透明边缘自然且不缺失 |
| 王座雕刻、衣饰与后墙 | 图案多，但服从大明暗形与主角焦点，并非均匀锐利 | 不照搬原图所有雕饰；新图减少无意义装饰噪点，保留必要识别特征 |

原图具有可见绘画肌理和少量颗粒；应提取有方向、依附形体的自然笔触，不放大颗粒、压缩噪声或重复纹理。干净通透不等于把暗部洗亮、去掉笔触或把材质磨成光滑 CGI。

## Shared prompt core

下列核心与共享质量核心一起用于本选项的两种输出模式，另加主体与模式约束。具体配色、衣服、人物身份不属于固定风格。

> Gothic Painterly Realism, semi-realistic digital oil painting. Match the supplied style-only reference's two-dimensional painted construction: expressive directional brushwork following anatomy and fabric folds, broad continuous sculptural color masses, credible human skeletal and facial structure, and restrained traditional oil-painted materials. Build cheeks, forehead, hands, and fabric from economical medium-to-large connected painted planes; brush marks construct the form itself. Group hair into directional locks, cloth into spacious dark masses, and distant architecture into quiet simplified shapes with few surface motifs. Baroque chiaroscuro / Tenebrism with a clearly motivated key light, controlled warm-cool separation, and deep shadows retaining color and readable form. Use hard, soft, and lost-and-found edges to guide attention. Selective detail on faces, eyes, anatomically coherent hands, and essential identity or story props; simplify secondary fabric, ornament, and distant forms with broader natural strokes. Restrained saturation, clean readable color planes, low noise, uncluttered texture, and crisp focal accents without overall sharpening. Preserve painterly transitions and spacious dark masses. No photographic skin or pores, no 3D render, no PBR or CGI surface response, no plastic gloss, no procedural microtexture, no meaningless speckles, random particles, dirty grain, or uniformly dense detail.

## 防止漂移

- 风格参考只决定绘画语言，不决定新人物长相、尖耳、红眼、吸血鬼身份或姿势。身份图与文字要求分别约束身份；不要把新主体替换成参考图中的 Strahd。
- 青蓝环境光、暖橙火光、酒红强调是该图的光色组合，不是全局固定色表。可用绿色森林光、冷灰日光或单一暖灯，但必须保留明确光源、大面塑形、边缘层级与选择性细节。
- “电影感”指画面构图、景深层次与叙事照明，不是照片滤镜、镜头光斑或三维游戏截图。
- 题材相同、蓝橙调色相同，不足以证明画风一致。并排查看笔触方向、色面体积、焦点精度、阴影组织和材质表现。

