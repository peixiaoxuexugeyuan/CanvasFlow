---

## name: character-sheet-prompt version: 1.0.0 description: &gt;- 把「一个角色」变成一张 3D 动画角色设定卡（Character Sheet）的完整绘图提示词。采用固定版式骨架 + 可替换槽位的模板化方案：左侧全身主视觉、中间三面转身图、右侧细节特写、下方服饰装备拆解、右上角色彩板、中文角色档案。内置多套美术风格预设（默认《哪吒之魔童降世》国漫三维，可换白蛇新国风 / 日式赛璐璐 / 美漫三维 / 写实厚涂 / Q版三头身）。适用于游戏与影视角色概念设计、AI 出图（Midjourney / Nano Banana / 即梦 / Seedance 等）提示词撰写、角色三视图与设定集排版、批量生成一整套角色卡的提示词。触发词：角色设定卡、角色卡提示词、character sheet、三视图、转面图、设定集、角色拆解、装备分解图、三面图、角色档案卡、帮我把这个角色做成卡片。 description_zh: &gt;- 给 AI 画图工具写「角色设定卡」提示词的助手。你只要描述一个角色（名字、年龄、职业、长相、穿什么、拿什么），它就输出一段可直接粘贴去出图的完整提示词：左边是角色全身正面大图，中间是正面/侧面/背面三面转身图，右边是脸和手部道具的微距特写，下边是服装道具一件件拆开平铺并配中文标签，右上角是角色的专属配色色板，还有姓名年龄职业的中文档案。风格默认是《哪吒之魔童降世》那种国漫三维质感，也可以换成其他画风。同一张卡里保证是同一个人，脸、发型、衣服不会串。它也支持换画风、换版式、一次批量出多个角色。 description_en: &gt;- Turns a character description into a complete image-generation prompt for a 3D animated character sheet: full-body front view on the left, three-quarter turnaround (front/side/back) in the middle, close-up detail callouts on the right, an exploded wardrobe-and-props lineup with Chinese labels at the bottom, a colour palette swatch strip in the top right, and a Chinese character profile (name / age / occupation). Ships with swappable art-style presets — default is the stylized 3D Chinese-animation look of "Ne Zha". Enforces identity consistency across every view and keeps a fixed negative-prompt block. Also supports batch generation of multiple characters. disable: false agent_created: true

# character-sheet-prompt

## When to use

- 用户要「角色设定卡 / character sheet / 三视图 / 转面图 / 设定集 / 装备拆解」类的出图提示词。
- 用户给了一段具体的角色卡提示词，要求「模板化」「去掉具体设计」「换成我的角色」。
- 需要一次产出多个角色的设定卡提示词（批量）。

## 核心思路：骨架固定，槽位可换

一张设定卡 = **不变的版式骨架** + **可替换的内容槽位**。

- **骨架不 invent**：左主视觉 / 中三视图 / 右特写 / 下拆解 / 右上色板 / 档案文字 / 负面词——这七块的位置与职责固定，换角色不动它。
- **槽位必须"实体化"**：每个槽位填的是「材质 + 物件 + 细节」（如"腰系焦黄补丁围裙"），不是空泛形容词（如"很有江湖气"）。空泛词 = 出图漂移。
- **一致性靠复述**：关键特征（五官、发型、体型、服装结构）在主视觉写死，再在三视图段要求"绝对一致"，不要指望模型自己脑补。

## Steps

1. **选画风预设**：读 `@references/style-presets.md`，默认用 `ne-zha-3d`（国漫三维）。用户明确要别的风格就换对应预设，或按其描述新建一条。
2. **收齐槽位**：按 `@references/slot-guide.md` 逐槽填写。用户给的信息不全时，**先按角色身份与题材合理补全并标注「（我补的，可改）」**，不要反问一堆问题卡住流程。
3. **生成提示词**：以 `@assets/template.md` 为母版填入槽位，输出完整中文提示词。
4. **批量场景**：槽位值写成 JSON，跑 `scripts/render_prompt.py` 一次渲染多个角色。
5. **跑自检**：见 Verification。

## 一致性红线（写提示词时必守）

- 三视图段必须复述：**建模比例 + 头部造型 + 服装结构 + 配色** 四项一致。
- 全图**只出现一位角色**——负面词里已有"重复人物 / 多个主角 / 多个角色混在一张图里"，不要删。
- 拆解区的物件**必须**与主视觉身上穿戴的物件一一对应，不多不少。
- 色彩板的 4 个色**必须**来自角色自身材质（如"生铁黑"来自铁锅），不能凭空造色。

## 版式变体（骨架可微调，不要重造）

变体改法竖版 3:4CANVAS 换竖版；左侧主视觉上移，拆解区加高纯三视图卡删右侧特写与下方拆解，中间三视图放大为主表情包卡右侧特写换成 4\~6 个表情头像，删三视图双人卡仅当有此需求时，主视觉改并列双人；一致性段改为"两位角色各自保持稳定"，负面词去掉"多个角色"改为"无关路人"

默认版式为**横版 16:9 单角色全要素卡**，无明确要求时不改。

## Verification

产出提示词后逐条自检：

- \[ \] 七个版式区块齐全（主视觉 / 三视图 / 特写 / 拆解 / 色板 / 档案 / 负面词）？
- \[ \] 每个槽位是「材质 + 物件 + 细节」，没有"很酷/很有气质"这类空词？
- \[ \] 姓名、年龄、职业三项档案齐全且为中文？
- \[ \] 色彩板 4 色，且每色都能在角色身上找到出处？
- \[ \] 拆解清单与主视觉穿戴的物件一一对应？
- \[ \] 三视图段写明了"比例 + 头部 + 服装结构 + 配色"四项一致？
- \[ \] 负面词块完整保留（尤其是"重复人物 / 多个主角 / 文字乱码 / 手指畸形"）？
- \[ \] 用的是选定画风预设的措辞，没有混入其他风格的词（如国漫卡里出现"日式赛璐璐"）？

## 关联资源

- `@assets/template.md` — 提示词母版（含 `{{槽位}}` 占位符，脚本与人工共用）
- `@references/slot-guide.md` — 每个槽位怎么填：写作规范、字数、正反例
- `@references/style-presets.md` — 画风预设库（6 套，可替换 / 可新增）
- `@references/examples.md` — 2 个完整填充示例（国漫伙夫少年 / 新国风女舵手）
- `scripts/render_prompt.py` — 用 JSON 槽位批量渲染提示词

```bash
python scripts/render_prompt.py --slots slots.json --out out.txt
python scripts/render_prompt.py --slots slots.json --check   # 只检查未填槽位
```