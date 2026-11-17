# 完整系统索引

当前视频编译主链：本次生产范围内全部正式分镜审核闭合 → 逐边界判定强/弱/无连续性并写入实际连续参考 → 全范围视觉参考完整性复查（角色/场景点位/道具状态/表情/特效/关键帧/连续性参考）与静态补图审核 → 参考完整性复核和运行时依赖排程 → 已就绪镜的深度故事板生成 → 结构/深度审核 → 正式分镜语义合规审核 → 视频 Promote → 视频生成；同场景时间连续的多点位使用场景连续参考，不得独立生成；如子镜需前镜实际视频尾帧，须在前镜视频通过后补齐尾帧与派生起幅图，子镜才进入故事板。深度故事板与视频 Promote 规范见 `prompt-assembly.md`；视觉资产、特效与去噪见 `reference-visual-assets.md`；调度见 `production-list.md`；连续性桥接见 `continuity-bridge.md`。

本文件仅作索引，不规定单个 reference 的文件大小上限。LibTV Agent 执行入口只读 `SKILL.md`；流程骨架、routing_rules 与文件调用契约已内置于 `SKILL.md`。具体规则以对应模块文件为准：

- `references/full-system.md`：完整系统索引与全局入口说明。
- `references/core-rules.md`：核心职责、Seedance2.0 / LibTV / Agent 工具边界、触发范围、响应决策、生成模式、路径选择、长文本、可行性检查、全局规则。
- `references/production-list.md`：制作清单、视觉控制包、创作确认清单、模型指定方法、参考素材规划、分镜逻辑断裂检查、视频生成 promote 调度、引用规则、全项目素材清单与单镜限制。
- `references/reference-visual-assets.md`：参考视觉资产规划、角色/场景/道具/特效/色板/表情/关键帧硬性模板、创作确认清单，以及初审→按需去噪→终审规则。
- `references/reference-audio-processing.md`：参考音频处理、角色音色、上传音频锚点、`enableSound` 与 `sound` 分层转换、音频参考能力边界、累计时间轴规则。
- `references/continuity-bridge.md`：跨镜头一致性、长镜头拆分、尾帧/首帧/尾部2秒视频桥接、关键帧与尾帧初审→去噪→终审门禁、A→B 状态变化、首帧节点去重规则。
- `references/style-rules.md`：风格锁定、风格隔离、风格与色板协同控制。
- `references/templates.md`：完整分镜模板、快速模板、BLOCKING 模板升级规则。
- `references/writing-rules.md`：写作规范、降噪规则、情绪/心理边界、风格规则、LibTV 转化规则、分镜维护能力。
- `references/prompt-assembly.md`：正式分镜经深度故事板后编译为 `generate_video_v3.prompt` 的自然语言组装顺序、nodeKey 插桩、连续性优先级和禁写字段硬规则。
- `references/checks-state.md`：错误等级、警告隔离、时长核算外置、状态块、自查表。
- `references/library-visual.md`：色板资产、摄影机、微缩模型、光影资料库。
- `references/library-motion.md`：@MOVEMENT 运镜体系。
- `references/library-blocking.md`：@BLOCKING 复杂调度资料库。
- `references/library-angle-focus-edit.md`：@ANGLE、@FOCUS、@EDIT。
- `references/library-audio-emotion.md`：声画关系、情绪外化、音效、节奏、转场、负面约束、替代方案、对白模块。
- `references/examples-maintenance.md`：示例、动态测试和版本维护记录。
- `references/test-cases.md`：触发与验收测试。

注意：资料库中的 `@图_`、`@色板_`、`@音_`、`@视频_` 示例只是占位示例；正式分镜只能引用用户已确认、已生成或已提供的素材。文档 / LibTV CLI 层用 `{{Node <nodeKey>}}` 或唯一节点名 `{{Node "节点名"}}` 闭合；Agent `generate_video_v3` 工具层执行前转换为 `{{nodeKey}}`，声音参数也从 `enableSound=off/on` 转换为 `sound: "off"/"on"`。
