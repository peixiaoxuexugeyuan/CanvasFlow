# 图片模型适配

能力核验日期：2026-10-17。模型与平台功能可能变化；涉及版本、参考图、编辑方式和参数时，按实际入口再次核对。LibTV 是否开放或透传下列官方功能尚未确认，不能把官方支持写成平台已经支持。

## 共同原则

先确定图片用途：场景资产、角色资产、剧情单帧或参考图编辑。三路写法共享同一份主体、空间、材质和光影设计，再调整表达形式。图片只描述一个可见状态，不混入秒数、运镜过程、对白和连续动作。

场景图先写地点结构、视点、景别和前中后景，人物只在需要时提供尺度；角色图先写脸部特征、发式、服装结构和可辨的全身比例，采用便于识别的背景与柔光。剧情帧再结合人物关系。不要让所有用途都变成浅景深半身美人照。

## Image：底层模型不明确时

“Image”可能只是平台入口名称，不能自动等同于 GPT Image、Imagen 或其他具体模型。使用可读的自然语言分段：图片用途与画幅 → 主体和位置 → 场景结构 → 光线与材质 → 必要约束。

写清“什么位于哪里、谁占多大、光从哪里来、哪些细节需要保留”。例如把“朦胧电影感”展开为“薄云下的侧前方日光，面部明暗过渡柔和，近处木纹可辨，远处屋舍逐渐柔和”。把关键画面信息放在前面，限制条件保持简短。不加入无法确认的专用参数。

## Banana / Nano Banana：自然语言与局部迭代

优先组织完整、具体的摄影描述，不堆关键词。主体、空间、摄影关系要相互一致：全身角色需要脚部完整，宽阔场景需要可读的环境，细节特写才强调局部纹理。

提供参考图时，逐张说明职责，例如“参考图一只用于人物身份和发式，参考图二用于服装结构，参考图三用于光影和色彩”。先确认平台能接收这些图片；没有上传的素材不能写成已提供。参考有冲突时，说明哪张主导哪项，避免要求全部完全一致。

已有满意结果时，每轮只调整一个明确问题，例如“保留人物、服装、画幅和店铺位置，只将面部右侧阴影稍微提亮，木铺仍保留暗部层次”。修正后比较目标部位及关联区域，出现身份或构图漂移时回到上一张可靠图。不混入 Midjourney 参数，不把品牌名称当作固定版本能力的保证。

## Midjourney：常规生图与 Edit 分开

常规生图使用紧凑英文，按“主体或场景 → 构图与空间 → 可见状态 → 光线与材质”排列。场景资产将环境放在句首；角色资产将身份特征和服装放在句首。少用长篇导演命令和不可见的故事背景，用具体名词、位置与状态替代连续的审美形容词。

例如：`A modest timber flower shop on a riverside lane, wide street-level view, open display counter on the right, clear walking space on the left, grey tiled roofs receding into the distance, soft overcast daylight, readable wood grain and woven baskets.`

正文与参数分开交付。只有入口已确认支持时，才提供如 `--ar 16:9 --raw --s 50` 的参数行。Raw 使用 `--raw`；Stylize 范围为 0—1000，较低值更贴近描述。`--s 50` 只是本 Skill 的试验起点，并非官方推荐值；根据结果单独调整，不承诺固定值必然更真实。

`--sref` 用于视觉风格，不能当作人物身份锁定。`--oref` 属于 V7 的 Omni Reference，不要移植到 V8.1 / V8.2。V8.1 / V8.2 需参考图编辑时，应核对 Edit 入口；官方 Edit 最多接收四张参考图，Discord 形式为 `--edit URL`。Edit 可使用明确修改指令，并说明需要保留的区域；这与常规生图的紧凑描述写法不同。V8.x 不加入 `--q` 或 `::` 多提示词权重。

平台未开放对应能力时，继续交付通用正文和平台当前可用的参考图说明，不要求用户更换平台，也不假设参数已经生效。

## 官方依据

- [Midjourney Prompt Basics](https://docs.midjourney.com/hc/en-us/articles/32023408776205-Prompt-Basics)：短而具体的常规提示词。
- [Raw](https://docs.midjourney.com/hc/en-us/articles/32634113811853-Raw)、[Stylize](https://docs.midjourney.com/hc/en-us/articles/32196176868109-Stylize)：参数格式与风格化范围。
- [Style Reference](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference)、[Omni Reference](https://docs.midjourney.com/hc/en-us/articles/36285124473997-Omni-Reference)：风格参考与 V7 对象参考的区别。
- [Edit Model](https://docs.midjourney.com/hc/en-us/articles/48495453462797-Edit-Model)、[Version](https://docs.midjourney.com/hc/en-us/articles/32199405667853-Version)：编辑入口、参考数量及版本兼容性。
- [Google 图像生成文档](https://ai.google.dev/gemini-api/docs/image-generation)、[图像提示词建议](https://blog.google/products-and-platforms/products/gemini/image-generation-prompting-tips/)：自然语言描述、参考图编辑及逐步修正方法。
