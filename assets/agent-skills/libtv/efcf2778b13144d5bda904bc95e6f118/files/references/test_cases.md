# Test Cases for Papercraft Animation Guide

## Test 1: 最小触发请求

- User request: “使用 $papercraft-animation-guide，帮我把‘一只小狐狸穿过春天森林’设计成 15 秒纸艺动画分镜。”
- Why it should trigger: 用户明确命名 skill，并要求将主题设计成 15 秒纸艺动画分镜，正是该 skill 的核心输出。
- Expected workflow/capabilities: 读取纸艺风格指南；先输出资产阶段需求：小狐狸三视图、森林三方向、纸花/草丛等道具参考；资产确认后使用默认 15 秒五镜头结构输出分镜和提示词。
- Expected artifacts: 第一阶段为资产设计方案或资产预览提示词；第二阶段为 15 秒纸艺动画分镜方案和提示词包。
- Acceptance criteria: 先做资产再做分镜；角色包含正面/侧面/背面；场景包含正面/90°/180°；方案包含五个镜头；明确禁止波楞纸/瓦楞纸。

## Test 2: 典型完整请求

- User request: “使用 $papercraft-animation-guide，做一个 15 秒纸艺动画：主题是红色小车穿过夜晚城市，16:9。先生成小车、城市和道具资产，确认后再生成视频。”
- Why it should trigger: 用户需要完整纸艺动画 workflow：资产包、分镜方案、确认后生成视频。
- Expected workflow/capabilities: 明确主题和比例；生成小车三视图、城市三方向、路灯/路牌道具参考；调用资产确认；确认后生成 15 秒五镜头分镜；再次确认；随后可进行视频片段生成，并在需要时使用 CapCut 渲染能力合成。
- Expected artifacts: 资产方案或资产预览、分镜方案、确认后的最终 15 秒纸艺动画视频。
- Acceptance criteria: 不跳过资产确认直接生成；所有镜头引用已确认资产；主体和场景一致；画面不能出现 corrugated cardboard / ribbed cardboard / wavy cardboard / shipping box texture；最终视频时长约 15 秒。

## Test 3: 边界与修订请求

- User request: “使用 $papercraft-animation-guide，修正刚才的小猫方案：小猫每个镜头都不一样，而且太像瓦楞纸了。请先补角色三视图、场景三方向和道具参考，再继续 15 秒动画。”
- Why it should trigger: 用户指出主体漂移和波楞纸/瓦楞纸风格错误，正是新版 skill 的风格纠偏与资产优先流程。
- Expected workflow/capabilities: 停止继续直接生成镜头；回到资产阶段；生成或规划小猫正面/侧面/背面、场景正面/90°/180°、关键道具参考；强化 smooth flat cardstock layers、thin matte paper sheets；加入负面提示 corrugated cardboard、ribbed cardboard、wavy cardboard。
- Expected artifacts: 修订后的资产方案或资产预览；更新后的分镜提示词；必要时再生成视频。
- Acceptance criteria: 明确承认需要资产锁定主体；不再使用波楞纸/瓦楞纸视觉；后续镜头都引用资产参考；风格是平整分层纸艺而非纸箱材质。