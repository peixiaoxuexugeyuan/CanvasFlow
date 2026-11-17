# 4 · 民俗粉彩怪诞

主图：[R06 洛琳达完整场景](../../assets/art-library/mother-lorinda.webp)。[R04 同角色抠图](../../assets/art-library/mother-lorinda-transparent.webp) 仅辅助辨认造型与轮廓。

## 可见画法

完整场景以偏粉、淡黄、灰绿和灰紫构建民俗仪式：人物脸与爪手较清楚，衣物和花环由碎而有组织的干笔、粉彩式擦痕和柔和色层形成；周围人物与林木边缘较软，亮雾/逆光让画面明度较高。其不安来自人物与庆典场景的反差，不是全画压暗。

保留有形体依据的粉彩干笔，合并花环和布纹，不复制每一处细碎颗粒与磨损。新任务不自动添加献祭、尸体、受害者、流血或人物爪牙。怪异结构以用户身份要求为准。

R04真实Alpha范围为0–255，正确合成后隐藏RGB中的横向色带不显示；丢弃Alpha直接转RGB会暴露色带。可见脚下地面仍保留，不符合本Skill纯人物立绘的无地面要求。用R06读取画法；需要重现洛琳达外观时，可把R04当身份/轮廓辅助图，明确保留Alpha且不移植隐藏色带和脚下地面。

## Shared prompt core

> Uncanny folkloric pastel-and-dry-brush illustration. Follow the intact primary reference's softly layered chalky color, purposeful broken dry-brush marks following form, warm pale light against muted colored shadows, and a balance of clearer expressive facial or hand features with softer surrounding shapes. Group fabric, foliage, and ornamental clusters into larger readable masses, preserving a handmade storybook quality and coherent anatomy. Use gentle luminous value ranges and selective edge definition to create unease through staging and expression, while keeping color clean, texture economical, and secondary detail quiet. Preserve controlled pastel-like marks without copying extraction streaks, distressed overlays, dense grain, or photographic surfaces.

character清除环境、地面与原图残影，保留粉彩感与真实透明边缘；narrative通过完整空间与柔和层次建立仪式感。不能将“哥特”自动等同暗到发黑。
