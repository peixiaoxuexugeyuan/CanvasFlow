# 《天空》AI电影制作 Skill V4（libTV Agent｜Minimum 4s版）

本版本针对“模型生成视频最短4秒”的实际生产约束重新梳理。

## V4最重要的变化

### 1. 双时长体系
- Edit Duration：正片最后使用时长，可以1秒、2秒、3秒。
- Generation Duration：模型实际生成时长，**任何单条不得低于4秒**。

### 2. 所有短动作采用4秒以上封装
`Head Handle → Core Action → Tail Handle`

核心动作即使只有0.7秒，也必须放进至少4秒完整视频里生成。

### 3. 白模 / Previs同样不得短于4秒
新的数据库：
`references/previs_reference_database_v2_min4s.md`

所有关键镜头均重新规划了：
- Reference Clip Duration
- Previs Generation Duration
- Edit Duration
- Edit Target
- 4–10秒完整时间轴

### 4. 影视参考视频截取也不得短于4秒
目标动作可以很短，但必须保留动作前后上下文。

## 典型调用
- “按《天空》Skill，为镜头003做5秒Previs，并给最终1.2秒剪辑窗口。”
- “按《天空》Skill，生成镜头010完整Prompt包，所有生成单元不得低于4秒。”
- “按《天空》Skill，把镜头004拆成多个4–6秒生成单元。”
- “按《天空》Skill，检查这套镜头任务表是否存在低于4秒的生成视频。”

## 核心原则
A镜：4–6秒生成，再剪。
A+镜：4–6秒生成，再剪。
S镜：5–8秒生成，再剪。
S+镜：6–10秒生成，再剪。
世界观镜头：6–12秒生成，再剪。
