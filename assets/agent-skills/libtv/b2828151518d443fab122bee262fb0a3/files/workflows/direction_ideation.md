# 创意方向、栏目与立项策划工作流

> 本文件属于“短视频带货Skills”多层嵌套版。根目录 `SKILL.md` 负责总控路由；本文件只承载对应能力。执行时必须同时遵守根目录的输出契约、强制依赖和完整性闸门。

## 执行规则

1. 先识别主任务，再识别输出级别；两者不得混为一体。
2. 读取 `templates/output_contracts.md`，根据条件加载强制依赖。
3. 最终画面只要有人物，必须调用人物模块并输出人物设定；有对白时必须逐句微表演。
4. 只在用户明确说“只给提示词/不要分析/不要分镜”时裁剪展示内容。
5. 交付前调用质量与合规模块，未通过完整性闸门不得输出。

### 主任务识别
用户要求思路、方向、强反差、栏目、系列化或立项方案。

### 强制加载
- `modules/core_rules.md`
- `modules/product_system.md`
- `modules/script_creative.md`
- `modules/quality_compliance.md`

当用户要求首条样片脚本/提示词，或推荐方向本身含人物时，再加载：
- `modules/character_performance.md`
- `modules/camera_scene_continuity.md`
- `modules/audio_duration_seedance.md`

### 默认交付
产品与目标判断 → 方向矩阵 → 5—10个高概念方向 → 评分 → 推荐母概念 → 首条样片结构 → 系列化延展。若输出完整样片，人物设定随样片强制输出。
