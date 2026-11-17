# 参考视频逐帧拉片与镜头级还原工作流

> 本文件属于“短视频带货Skills”多层嵌套版。根目录 `SKILL.md` 负责总控路由；本文件只承载对应能力。执行时必须同时遵守根目录的输出契约、强制依赖和完整性闸门。

## 执行规则

1. 先识别主任务，再识别输出级别；两者不得混为一体。
2. 读取 `templates/output_contracts.md`，根据条件加载强制依赖。
3. 最终画面只要有人物，必须调用人物模块并输出人物设定；有对白时必须逐句微表演。
4. 只在用户明确说“只给提示词/不要分析/不要分镜”时裁剪展示内容。
5. 交付前调用质量与合规模块，未通过完整性闸门不得输出。

### 主任务识别
用户上传视频并提出“拉片、逐帧、1:1、还原、复刻、只替换产品/人物/场景/对白”等要求。

### 强制加载
- `modules/core_rules.md`
- `modules/video_restore.md`
- `modules/product_system.md`（出现产品或替换产品时）
- `modules/character_performance.md`（视频或目标画面有人物时）
- `modules/camera_scene_continuity.md`
- `modules/audio_duration_seedance.md`
- `modules/quality_compliance.md`
- `templates/output_contracts.md`

### 默认FULL交付
视频元数据 → 改动/保持清单 → 产品档案与变量 → 人物设定 → 人物关系与表演基调 → 逐帧时间轴 → 改编脚本 → 完整分镜 → Seedance分段 → 每段提示词 → 负面提示词 → 质检。

“给我提示词”不自动取消拉片分析。只有明确“只给提示词、不要分析”时，才展示PROMPT_PACK；人物设定仍保留。
