# Dual-Model Output Template

Begin with exactly:

`【项目定位】[EPxx-Sxx | 当前阶段：提示词已交付·待生成回传]`

Then output the required labels and fenced `text` code blocks in this order:

1. `【场景资产图提示词】` — only when a full-scene helper asset is required.
2. Scene asset map code block.
3. `【主要人物站位图提示词】` — only when a full-scene helper asset is required.
4. Blocking map code block.
5. `【Seedance 2.0版本】`
6. Seedance code block.
7. `【Kling VIDEO 3.0 Omni版本｜Kling O3】`
8. Kling code block.

Add no other prose before, between, or after them.

Neither video prompt may mention or explain the internally analyzed material.

## Scene asset map template

```text
画幅：1:1 或 4:3｜用途：场景资产图
Prompt：高角度俯拍 / 鸟瞰视角，完整展示【场景名称】的整体空间结构，清晰展示墙体边界、门、走廊、楼梯、窗、主要家具和固定道具位置；所有出入口必须用清楚的中文标识；必要时标识卧室区、客厅区、玄关区、书桌区、阳台区等功能区域；画面以空间清晰、布局稳定、便于后续镜头统一为优先，不追求戏剧化透视，不遮挡关键区域。
```

## Principal blocking map template

```text
画幅：1:1 或 4:3｜用途：主要人物站位图
Prompt：基于同一场景的高角度俯拍完整空间图，生成主要人物站位图；保持与场景资产图一致的空间边界、出入口、家具和固定道具布局；用清楚的中文标出主要人物姓名、初始站位、朝向、关键移动路径和出入口使用路径；必要时标识人物与关键道具的交互点；画面重点是站位清晰、关系明确、便于后续多镜头场景统一。
```

## Seedance 2.0 template

Keep this version compact and production-ready. Do not include `【目标模型】` or `【执行校验码】`.

```text
编号：EPxx-Sxx｜画幅：9:16 / 16:9 / 2.39:1｜总时长：10s
角色与资产绑定：图1＝角色A（身份、发型、年龄感、体型、服装、妆造）；图2＝角色B（身份、发型、年龄感、体型、服装、妆造）；衔接视频1＝仅S02+使用，锁定开场动作相位、机位惯性、原生音频与最后稳定1-2秒的综合色卡状态；场景资产图1＝仅在已提供时使用，锁定完整空间、出入口和主要背景锚点；站位图1＝仅在已提供时使用，锁定主要人物站位、朝向和关键移动路线；色卡图1＝可选辅助，不得覆盖衔接视频1的实际影调。
短剧白柔光与色卡：用一句到两句写清综合色调、面部亮度、肤色、阴影和黑位关系、实景高光、白柔光扩散、辉光、微对比、颗粒与锐度；S02+必须说明以衔接视频1最后稳定1-2秒为最高优先级色彩参考，00:00无跳色，同场景切镜不得重置调色或美颜强度。
Prompt：镜头1｜00:00-00:xx，……；镜头2｜00:xx-00:xx，……；镜头N｜00:xx-00:10，……；每个镜头都写清景别、构图、人物动作起点-过程-终点、运镜路径、关键道具、光线、BGM/环境音/拟音、英语对白及口型同步；如有短插镜不得省略；结尾保留下一段需要的画面和原生音频衔接状态。
对白英语化：仅在有对白时填写，条目数量严格等于实际对白数量。格式：角色名｜时间｜情绪/画内外｜“English line.”
要求：保留原音乐 / 保留环境音 / 保留拟音 / 无任何字幕 / 人物在正侧背面和切镜中身份不得回弹 / 不增加、不合并、不重排镜头 / 不保留中文人声 / 不生成与要求冲突的背景音乐。
```

## Kling VIDEO 3.0 Omni template

Keep this version concise and aligned with Kling Custom Multi-Shot style. Do not include `【目标模型】` or `【执行校验码】`. Bind principal subjects once only.

```text
编号：EPxx-Sxx｜画幅：9:16 / 16:9 / 2.39:1｜总时长：10s
主体与资产绑定：角色A＝主体元素{{准确名称或ID}}（参考来源：图X/视频X，声音状态：已绑定/未绑定）；角色B＝主体元素{{准确名称或ID}}（参考来源：图Y/视频Y，声音状态：已绑定/未绑定）；衔接视频1＝仅S02+使用，锁定开场动作相位、机位惯性、原生音频与最后稳定1-2秒的综合色卡状态；场景资产图1＝仅在已提供时使用，锁定完整空间、出入口和主要背景锚点；站位图1＝仅在已提供时使用，锁定主要人物站位、朝向和关键移动路线；色卡图1＝可选辅助，不得覆盖衔接视频1的实际影调。
衔接色卡绑定：仅S02+填写。以衔接视频1最后稳定1-2秒为最高优先级色彩与影调参考，匹配其冷暖关系、曝光、面部亮度、肤色、阴影、黑位、饱和度、实景高光、短剧白柔光扩散、辉光、微对比、颗粒与锐度；00:00无跳色，同场景切镜不得重置调色或美颜强度。S01则写当前场景的综合色彩和短剧白柔光目标。
Prompt：Shot 1｜00:00-00:xx：……；Shot 2｜00:xx-00:xx：……；Shot N｜00:xx-00:10：……；每个Shot都直接写景别、构图、人物动作起点-过程-终点、明确的运镜路径、关键道具、光线与原生声音；有对白时，直接在对应Shot里写：角色名（情绪，英语，画内/画外）说：“English line.” 已绑定声音的主体不再重复指定冲突音色；结尾保留下一段所需的画面和原生音频衔接状态。
要求：保留原音乐 / 保留环境音 / 保留拟音 / 无任何字幕 / 不增加、不合并、不重排镜头 / 不重复对白 / 不恢复旧主体或旧角色身份 / 人物在正侧背面和切镜中身份不得回弹。
```

## Cross-model rules

- Both video versions must contain the same shot count, shot order, time ranges, story facts, role identities, props, actions, transitions, sound events, and ending state.
- Both video versions must use the same clip-derived color state.
- For S02+, both must state that the continuation clip's final stable 1-2 seconds outrank a separate color card.
- Both may reference the same scene asset map and blocking map when available.
- Seedance may be more detailed.
- Kling must remain direct, compact, and free of Seedance-style validation boilerplate or technical data-sheet dumping.
- Never omit the Kling `衔接色卡绑定` line for S02+.
- Never deliver the video prompts before the principal Kling subject map has been explicitly confirmed.
- When a principal role is replaced, update both the Seedance role-image mapping and Kling subject mapping, and remove all superseded references.
