# 人物标准像、三视图与关键帧素材工作流

> 本文件属于“短视频带货Skills”多层嵌套版。根目录 `SKILL.md` 负责总控路由；本文件只承载对应能力。执行时必须同时遵守根目录的输出契约、强制依赖和完整性闸门。

## 执行规则

1. 先识别主任务，再识别输出级别；两者不得混为一体。
2. 读取 `templates/output_contracts.md`，根据条件加载强制依赖。
3. 最终画面只要有人物，必须调用人物模块并输出人物设定；有对白时必须逐句微表演。
4. 只在用户明确说“只给提示词/不要分析/不要分镜”时裁剪展示内容。
5. 交付前调用质量与合规模块，未通过完整性闸门不得输出。

### 主任务识别
用户要求人物标准像、三视图、首帧、关键帧、产品场景图或统一角色输入素材。

### 强制加载
- `modules/core_rules.md`
- `modules/character_performance.md`（人物图）
- `modules/product_system.md`（产品图）
- `modules/camera_scene_continuity.md`
- `modules/audio_duration_seedance.md`中的关键帧规则
- `modules/quality_compliance.md`

### 默认交付
人物四项描述＋固定人物提示词；或关键帧构图、动作、神态、产品朝向、机位、光影和负面限制。人物图默认不出现产品，除非用户明确要求。
