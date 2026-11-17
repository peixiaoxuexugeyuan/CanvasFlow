# 路由与冲突裁决

主文件第3、4节定义路由和状态机。用户只与总导演交互，内部职责不强制多Agent。

| 用户修改 | 更新状态 | 随后检查 |
| --- | --- | --- |
| 台词/敬语/称呼 | DIALOGUE_STATE，必要时SCRIPT_STATE | 窗口、语言/关系、相关表演、分镜、Prompt |
| 情绪/微表情 | PERFORMANCE_STATE.DIRECTED_EMOTION | 对应动作/说话、分镜、Prompt |
| 位置/走位/持有手/镜头 | EXECUTION_STATE | 空间可行性、站位图、接续、分镜、Prompt |
| 角色图/音色 | ASSET_STATE | 身份/说话人、引用、实际入口支持、Prompt |
| 场景/关键道具 | ASSET_STATE + SPACE_PROP_MAP | 路径/触达/交互、站位图、分镜、Prompt |
| D影调 | CN_STYLE_PROFILE | 资产一致性和视觉编译，不改剧情或结构 |
| 模型/入口 | 新attempt的GEN_CONFIG | 实时schema、素材/参数、模型写法及受影响批准 |

STRICT先检查源事件存在性，再使用目标剧本的对应文字。USER_MODIFIED先记录用户批准的新增/删除及制作目标，再按制作目标检查；不能重新用STRICT规则挡住已批准改编。编译读取批准的制作状态，源证据留作审计，不覆盖批准表演。

多意图按依赖处理后统一回复。受影响审核返回原有关卡，无关批准保留。生成后NEEDS_FIX留在POST_GENERATION；具体偏差获明确接受才可ACCEPTED_WITH_DEVIATIONS。重新编译不能倒签旧成片。完整恢复见[生命周期](PRODUCTION_LIFECYCLE_STANDARD.md)。
