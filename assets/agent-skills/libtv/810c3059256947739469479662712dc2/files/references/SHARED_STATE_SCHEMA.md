# 共享状态与版本

主文件第2、3、13、14节为运行合同。以下是内部账本字段，不是LibTV API字段。

| 状态 | 主写职责 | 关键内容 |
| --- | --- | --- |
| SOURCE_STATE | 执行导演 | source_revision、原始媒体、SH/D事件及不可被制作改写的RAW数量 |
| SCRIPT_STATE | 剧本导演 | script_revision、语言/关系、场景/台词ID、本段剧本范围 |
| EXECUTION_STATE | 执行导演 | production_revision、目标SH/动作/Blocking/C/F/A/END、SPACE_PROP_MAP |
| DIALOGUE_STATE | 台词导演 | 生产D父ID、源/剧本映射、目标文字/窗口、覆盖理由 |
| PERFORMANCE_STATE | 情绪导演 | 源表演证据、候选优化、批准DIRECTED_EMOTION |
| ASSET_STATE | 资产导演 | asset_id/node_key/revision、用途、适用镜头、身份参考、拉取日志与绑定清单 |
| DIRECTOR_CONSOLE_STATE | 执行/资产导演 | 已核定接续事实与调度，不作为上传参考 |
| PROMPT_STATE | 提示词导演 | compiled_from各制作revision、真实modelKey/modeType、frozen_params、完整正文 |
| NODE_STATE | 资产导演 | attempt_id、节点、写入/回读证据、提交记录、as_generated_snapshot |
| MODEL_BOUNDARY_STATE | 提示词导演/监制 | 实时schema证据、规则ID/范围/读取时间、冲突 |
| QA_STATE | 监制 | 编译QA/节点QA/媒体QA，结果、事件偏差、verification_mode、accepted_artifact_id |
| APPROVAL_STATE | 总导演记录 | 用户原话、批准对象revision、依赖revision、有效性与失效原因 |

SOURCE_STATE仅追加证据；源审计纠错创建新source_revision，保留旧版。USER_MODIFIED的新增/删除另存TARGET_SH_COUNT_LOCK/TARGET_D_PARENT_COUNT_LOCK及差异清单，新增源映射为null；RAW锁值不改。

每次生成attempt关联本段/分段、production_revision、冻结版本与实际生成记录。as_generated_snapshot和原始回片不可被新方案覆盖；不明确的实际配置标unknown。媒体导出尺寸与生成配置分别存，不从文件倒推出模型或绑定。

批准依赖以实际字段关系决定：关键道具变化可能使Blocking/站位图失效；纯外观参考不使无关台词失效；台词文字变化检查窗口及表演；影调仅使相关视觉编译失效。冻结后任何正文/绑定/参数变化均须重新冻结。源与制作事件用稳定ID，不用行号代替身份。
