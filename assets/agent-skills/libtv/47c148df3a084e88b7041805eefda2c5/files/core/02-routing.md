# 按意图、创作问题和依赖选路

每轮开始或问题改变时使用。最小输入是本轮用户意图、可找回的项目入口/当前版本、所涉范围和已有授权；没有项目也可以做独立咨询与创作草案。不能用空表宣称恢复成功。

## 先给本轮需要的作品

创意先形成具体情境/可演片段，已有剧本先解决本场事实与表达，导演先做人物行动和空间决定，分镜再组织观看与必要事件；依据下表读取当前责任模块。行动谱、空间关系和分镜可按需要合并在一份可读方案，不为流程额外交三张空表。制作参数、完整资产登记和预算核对在相应实际操作前展开，不作为文字创作前置。

## 先辨本轮行动边界

用户只问进度、查看资料、解释方案时，读取可信记录并回答，**即使旧批次仍获授权且有Job.ready任务，本轮也不因此提交、生成、重试或改版本**。用户另要求继续制作才进入执行选择。用户在持续工作中问状态时可简述状态后按其原有持续指令继续，但“先只看进度/暂停执行”明确收窄了当轮动作。

恢复时按[状态恢复](04-state-recovery.md)核对并隔离未决请求；优先核对不是要求先解决全项目所有unknown才能创作或生产。用户点名的局部范围优先，处理会造成错误消费/重复提交的相关问题，然后选择有条件推进的工作。

<a id="director-control-gate"></a>
## 导演质量闸门：把判断传到下游

形式上读取导演文件，不等于导演已经控制生成。凡是要把资产、图像、视频或剪辑版本落为本项目正式候选，必须携带同一版 **Director Pack**：观众此刻要读到的观看问题；必要事件及先后；人物行动、反应与可见停顿；黑白空间布局/调度依据或明确的受限小样说明；摄影覆盖与镜头接缝；声音职责；引用素材的用途与版本；以及可观察的验收判据。Director Pack 可按项目、集、场、镜或资产级建立；与本级别无关的字段写“不适用＋理由”，不能留空冒充已核。只有这些字段相互一致、事件映射完整、空间路径可解释后，Director Pack 才可标为 `accepted-for-generation`，并在[核心记录](03-records.md#director-pack-record)中登记。

下游请求卡必须回显 Director Pack 版本、消费的事件/镜头或资产用途和验收判据。缺版本、缺事件映射、引用错位、空间/动作冲突或只有“电影感”等抽象评价时，退回导演/调度/资产责任处，不能靠补形容词提交。探索图或探索视频可以在用户明确把它当草案时生成，标 `exploration`；补齐用途设计、实际观察和 Director Pack 后可按核心用途结论晋升，不能在缺口未补时直接作为正式母版、场景基准、调度依据或正片 Take。

结果回来后，导演闸门再次检查实际画面/声音：产物结论只用核心五值 `acceptable`、`repair`、`unusable`、`unobservable`、`unreviewed`；`repair` 必须写根因层级和受影响下游，`unobservable` 不能改写成通过。任务成功、文件存在或 Agent 自评都不能替代这次检查。Director Pack 的 `accepted-for-generation` 只表示生成前设计已核，不表示产物质量通过。

平台内置流程的概念（续镜锚点、锚点集、定稿账、反碎化、分区 prompt spec）不替代本 Skill 的末态观察、资产索引、Scene 记录、镜头拆分与七段；对照见根 SKILL.md 路由表后的说明。附属文件由 `skill_file` 按根 SKILL.md 路由表的明文路径读取。

## 路由表

| 触发 | 先解决的决定 | 读取模块与下一步 |
|---|---|---|
| 原创长片/长剧、比较创意或结局 | 观众承诺、人物选择、持续发展机制 | [创意](../creative/01-development.md) → [长篇结构](../creative/02-series-and-feature.md)，候选足够具体即可继续发展 |
| 小说/已有剧本、改编/单场写作 | 原文事实、改编权限、场功能 | [场景写作](../creative/03-scene-writing.md)；未要求全季不扩大 |
| 导演阐述、表演、沉默或群像无力 | 人物行动、反应链、注意力 | [表演](../creative/04-directing-performance.md) → [场面调度](../creative/05-blocking-action.md) |
| 分镜、摄影或接不上 | 观众需要看见/听见什么、空间关系和必要事件 | [覆盖](../visual/02-cinematography-coverage.md) → [分镜预演](../visual/03-storyboard-previs.md) → [接续](../visual/04-continuity-seams.md) |
| 风格/美术设计 | 全片共同语言和叙事阶段可变量 | [风格](../visual/01-style-art.md) → [资产需求](../assets/01-asset-planning.md) |
| 人物/表情/姿态图组、场景空间图、道具交互图 | 默认形式、本批必要设计、真实引用与验收 | [人物](../assets/04-character-and-performance-templates.md)、[场景调度](../assets/05-scene-and-blocking-templates.md)、[道具交互](../assets/06-prop-and-interaction-templates.md)；先排戏/机位意图，再按需补图，不等全季资产 |
| 有资产/已有成片 | 真实来源、适用故事状态、实际可观察资格及资产级 Director Pack 是否足以把它作为正式来源；若上游设计缺失先补设计 | [风格/资产需求](../visual/01-style-art.md) → [资产验收](../assets/02-asset-build-review.md) → [选片](../post/01-observation-selection.md)，只补缺失依赖 |
| 明确要生图/视频 | 所请求范围的创作依据、引用、能力、授权及 `accepted-for-generation` Director Pack 是否足够；若上游设计缺失先走创意/导演/覆盖/资产设计行 | [任务拆分](../generation/01-shot-task-packaging.md) → [导演质量闸门](#director-control-gate) → 图像/视频提示词 → [调度](../generation/04-scheduling.md) → [提交核对](../generation/05-submit-reconcile.md) |
| 继续项目/批次 | 当前版本、未决Attempt、可用额度、实际依赖 | [恢复](04-state-recovery.md)后选可执行项；独立工作在可信条件下继续 |
| 质量不好/只修某镜 | 现象、时段、叙事后果、原因层级 | [审查](../quality/01-review-rubrics.md) → [最小返修](../quality/02-repair.md)，不默认改提示词 |
| 改人设/伤势/知情/风格 | 生效故事时间、属性、用途与版本影响 | [变更](05-change-impact.md)，扫描真实引用再决定保留/修复 |
| 剪辑、声音或交付 | 可用片段是否覆盖必要事件，适用 Director Pack 是否已核，当前能执行何种后期；上游设计缺失先补设计 | [创意/导演/覆盖](../creative/04-directing-performance.md) → [剪辑](../post/02-editing.md)、[声音](../post/03-sound.md)、[画面完成与交付](../post/04-color-titles-delivery.md) |
| 预算/授权变更 | 新预算、次数、模型、范围或停止条件是否已明确并接入原授权链 | [项目契约](../core/01-project-contract.md)更新授权与预留，再回[调度](../generation/04-scheduling.md)；不以改名重置累计 |
| 进入受限小样 | 网页能力仍unknown，但本会话、次数/费用上限、风险、停止条件、请求账本和已知来源均可核 | [项目契约受限小样](../core/01-project-contract.md#limited-sample-mode) → [调度](../generation/04-scheduling.md) → [提交核对](../generation/05-submit-reconcile.md)；每次调用建立limited-sample Attempt并计入授权账 |
| 关联、加载或资产规格被质疑 | 用户原文、当前实际对象/输入、可访问正文、所需形式及真实证据；先区分诊断与执行 | [引用诊断](../assets/03-reference-binding.md#reference-diagnosis)、[加载核对](../platform/01-libtv-capabilities.md#knowledge-access)或[资产验收](../assets/02-asset-build-review.md)；不以重贴标签/Agent自述宣布修好，不试错重投 |
| 指定Seedance2.5写/改提示词 | 当前观看、事件、状态/声音与可用引用；缺资料可留草案 | [视频编译](../generation/03-video-prompt.md) → [唯一规范及分支](../platform/04-seedance-25.md#seven-section-template)；只在上游缺失/失效时回补，写提示词不自动生成 |
| 模型找不到/工具或字段不明 | 入口作用域、新鲜度与真实契约 | [平台能力](../platform/01-libtv-capabilities.md)、[模型登记](../platform/05-model-registry.md) |

## 小范围上下文与迭代

开始只读项目摘要、当前集/场、这轮需消费的确切来源版本和待解决Issue/Attempt。当前局部设计影响跨集伏笔/知情时，再回读对应原记录，不能只凭摘要推断。需要几个有关模块就读取几个，不设“一轮只读一文件”，也不每轮全加载整个包。

创作决定可以互相修订：早期风格草图帮助确定叙事表达；导演发现空间矛盾可回剧本；实物参考不能实现关键事件时比较改变表达或补资产。任何返修说明为什么回到该层以及哪些下游须重审，不机械走完整流水线。

质量问题若表现为“事实都对但戏不成立”，先回观看问题和导演选择，再把明确改变落实到资产、摄影、视频Action/Camera、声音或剪辑；不要只补检查词。若已有两个都完整的候选，保留候选及收益/代价，交实际选片与整场观察决定。

选择工作时优先消除高代价的不确定性、解锁多个下游、补足当前交付的缺口。不要把产出视频数量当唯一收益，把声音/后期长期推后。故事先后关系不自动等于生产前置；[生产调度](../generation/04-scheduling.md)等待确实需要的设计依据、实际输入或末态；必要调度图即便不直接传给模型，也可构成正式批次的设计前置。

## 出口与检查

每轮回答“这次决定是什么、据什么、形成什么、下一步为何可做或为何暂停”，给出真实定位。只有计划就称计划；没有观察就不称通过；局部能力缺口只挡受影响分支。全片/全季完成需达到[交付](../post/04-color-titles-delivery.md)的实际条件，不能在文件写完时关闭生产目标。

以上是本项目的路由设计；专业方法与系统边界见[来源](../evidence/01-sources.md#method-boundaries)。[用户输出](06-user-output.md)负责可浏览呈现，本表不强制用户逐张确认。
