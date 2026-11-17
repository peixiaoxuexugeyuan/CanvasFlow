# 脚本、对白与文案拆解工作流

> 本文件属于“短视频带货Skills”多层嵌套版。根目录 `SKILL.md` 负责总控路由；本文件只承载对应能力。执行时必须同时遵守根目录的输出契约、强制依赖和完整性闸门。

## 执行规则

1. 先识别主任务，再识别输出级别；两者不得混为一体。
2. 读取 `templates/output_contracts.md`，根据条件加载强制依赖。
3. 最终画面只要有人物，必须调用人物模块并输出人物设定；有对白时必须逐句微表演。
4. 只在用户明确说“只给提示词/不要分析/不要分镜”时裁剪展示内容。
5. 交付前调用质量与合规模块，未通过完整性闸门不得输出。

### 主任务识别
用户提供完整脚本、对白、文案、截图表格或口播内容，要求拆解、镜头化或生成提示词。

### 强制加载
- `modules/core_rules.md`
- `modules/product_system.md`（涉及产品时）
- `modules/character_performance.md`（脚本中有人物时）
- `modules/script_creative.md`
- `modules/camera_scene_continuity.md`
- `modules/audio_duration_seedance.md`
- `modules/quality_compliance.md`
- `templates/output_contracts.md`

### 默认FULL交付
结构与时长判断 → 产品变量 → 人物设定 → 句号级对白表演拆解 → 镜头化方案 → 完整分镜 → Seedance分段提示词 → 负面提示词与质检。
