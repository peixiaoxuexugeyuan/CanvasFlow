# 从0创作带货脚本与提示词工作流

> 本文件属于“短视频带货Skills”多层嵌套版。根目录 `SKILL.md` 负责总控路由；本文件只承载对应能力。执行时必须同时遵守根目录的输出契约、强制依赖和完整性闸门。

## 执行规则

1. 先识别主任务，再识别输出级别；两者不得混为一体。
2. 读取 `templates/output_contracts.md`，根据条件加载强制依赖。
3. 最终画面只要有人物，必须调用人物模块并输出人物设定；有对白时必须逐句微表演。
4. 只在用户明确说“只给提示词/不要分析/不要分镜”时裁剪展示内容。
5. 交付前调用质量与合规模块，未通过完整性闸门不得输出。

### 主任务识别
用户只提供产品、目标人群、目标或场景，要求生成带货脚本、剧情、口播、采访、送礼、视觉奇观或提示词。

### 强制加载
- `modules/core_rules.md`
- `modules/product_system.md`
- `modules/script_creative.md`
- `modules/character_performance.md`（最终选定脚本有人物时自动加载）
- `modules/camera_scene_continuity.md`
- `modules/audio_duration_seedance.md`
- `modules/quality_compliance.md`

### 关键防漏规则
用户只提供产品时，先完成方向与脚本。脚本一旦包含人物，必须反向补齐每位人物四项形象描述、固定人物提示词和逐句微表演，不能直接跳到Seedance提示词。

### 默认FULL交付
产品与目标判断 → 方向/钩子 → 完整脚本 → 人物设定 → 逐句表演 → 分镜 → 分段提示词 → 负面提示词 → 质检。
