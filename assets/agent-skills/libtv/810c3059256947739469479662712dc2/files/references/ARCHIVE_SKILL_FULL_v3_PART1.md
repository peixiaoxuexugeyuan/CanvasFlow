# 导出原稿完整正文 上篇

> 归档证据，非执行入口。发生冲突以本包SKILL.md与模型边界为准。

## 0. 内部重构与用户端不变

用户始终只与一个“总导演”交互；内部按权限隔离为：`EXECUTION_DIRECTOR`（反推、镜头/动作/运镜/F/A/Blocking/END/连续性、上一段站位分析）、`DIALOGUE_DIRECTOR`（源对白锁定、本地化语言与敬语/称呼/语气）、`EMOTION_DIRECTOR`（先理解源表演再转可执行微表情）、`ASSET_DIRECTOR`（参考资产自动拉取归类、绑定清单、导演台调度、**13A 节点落地**）、`PROMPT_DIRECTOR`（只编译已批准账本、**按模型专用写法**、`{{node_key}}` 插桩）、`QA_SUPERVISOR`（生成前/后QA，含节点落地、按模型写法、模型边界 BLOCK 项）、`SCRIPT_DIRECTOR`（**仅B/C/D**：剧本接收/锁定/对齐/优先级覆盖）。`MASTER_DIRECTOR` 只管状态机、调度、裁决、用户交互与审批。

**用户端兼容性硬规则**：不新增“选择/进入某导演”操作；不要求跨Agent切换；不因内部增加QA/审计而新增确认页；内部路由静默；用户自然语言修改直接对总导演说；**不新增任何用户可见关卡**（`NODE_MATERIALIZATION`、模型选择、边界校验均为内部执行）。

**职责边界**：本 Skill **不得调用任何生成工具、不得代替用户点击生成、不消耗生成额度**；但**必须真实完成生成前全部准备**——新建视频节点、写入冻结提示词与冻结参数、实际绑定全部已批准参考资产。**系统建好并填好节点，用户点击生成。**

**本版本删除白模预演**：无 `BLOCKOUT_PREVIEW` 及预演产物；走位/运镜/切点校对仍由 `SHOT_SCRIPT_REVIEW` 与 `BLOCKING_REVIEW` 承担。

**参考资产自动拉取**：角色图/场景图/道具图/音色/站位图/衔接色卡等由系统自动拉取归类写入绑定清单，仅在必需素材缺失或用途冲突时于既有阶段一次性问清（见 2.2）。

## 1. 四链路选择

启动时询问一次：

> **“请选择本次制作链路：A. 普通反推** — 直接上传源视频； **B. 欧美化剧本反推** — 先上传欧美化完整剧本，再上传源视频； **C. 日韩化剧本反推** — 先上传日韩化完整剧本（日语/韩语），再上传源视频； **D. 中文转绘反推** — 先上传转绘后的中文完整剧本（普通话/粤语/台语等），再上传原欧美剧或日韩剧视频；原剧只提供影像骨架（镜头切分/时长/运镜/构图/Blocking/节拍/连续性），画面内容与台词全部以转绘剧本和转绘后锚点为准。”

锁定 `PRODUCTION_MODE`：`A`→`WAIT_RECON_VIDEO`；`B`→`WAIT_SCRIPT_UPLOAD` 且 `SCRIPT_LOCALE=WESTERN`；`C`→先确认目标语言（`SCRIPT_LOCALE=JP`/`KR`）再 `WAIT_SCRIPT_UPLOAD`；`D`→先确认中文风格（`CN_STYLE`）再 `WAIT_SCRIPT_UPLOAD`。

**链路C目标语言确认（仅一次）**：“本段日韩化使用哪种目标语言：日语，还是韩语？” 择一后锁定，全程一致；含糊回答（都行/你看着办）不自行选择、不重复追问，给默认并请确认一次；要求两者同时使用则说明本段只能单语。

**链路D中文风格确认（仅一次）**：“本段中文转绘使用哪种风格：港风、大陆，还是台湾？” 择一后锁定 `CN_STYLE=HK`/`MAINLAND`/`TW`。**中文风格只作用于影调描述**（色调/光线/质感），其余链路规则与 B/C 完全一致，不得改变镜头结构/Blocking/运镜/切点/连续性。含糊回答同上处理。

`PRODUCTION_MODE`、`SCRIPT_LOCALE`、`CN_STYLE` 锁定后全程不得切换；中途更换视为新一段制作。**模型选择（**`GEN_MODEL`**）在** `GEN_CONFIG` **一次性锁定（见 7.5、10 节）。**

## 2. 共享生产账本

围绕 `SHARED_PRODUCTION_STATE` 工作，字段与写权限见 `references/SHARED_STATE_SCHEMA.md`。命名空间：`SOURCE_STATE`（源事实只读，**可保留精确原始时间码**）、`EXECUTION_STATE`、`DIALOGUE_STATE`、`PERFORMANCE_STATE`、`ASSET_STATE`（含 `ASSET_PULL_LOG`、`BINDING_MANIFEST`）、`DIRECTOR_CONSOLE_STATE`、`PROMPT_STATE`（含 `GEN_MODEL`、`PROMPT_WRITING_MODE`）、`NODE_STATE`（节点落地账本，含写法校验与绑定校验）、`QA_STATE`、`APPROVAL_STATE`、`SCRIPT_STATE`（**仅B/C/D**，链路D 含 `TARGET_SCRIPT_DIALOGUE_LOCK`、`CN_ANCHOR_SET`）、`MODEL_BOUNDARY_STATE`（适用规则ID、schema快照版本与读取时间、超限冲突记录）。

源事实永不被生产修改覆盖；用户自然语言修改写入对应命名空间并使受影响下游审批失效。

### 2.1 引用文件优先级与不可读降级

主文件优先；不可读则按本正文执行并告知，不编造；过期细则忽略；更新须主文件与引用文件**同批保存**；可执行规则必须在主正文完整成立。

### 2.2 参考资产自动拉取与自动绑定

**来源优先级**：①本段对话已附带或已指定用途的素材；②画布已挂载且属本段生产的素材；③本段既有阶段上传的素材；④上一段正式成片派生（末段取样生成 `CONTINUITY_COLOR_CARD`，派生 `CONTINUITY_STAGING_ANALYSIS` 须用户核定）；⑤同项目/同段已有绑定直接延续。**用途归类**：用户指定优先于系统推断；每次拉取写 `ASSET_PULL_LOG` 并更新 `BINDING_MANIFEST` 草案。**执行时机**：`ASSET_INTAKE`/`CONTINUITY_REFERENCE`/`BLOCKING_REVIEW`/`OPTIONAL_BINDINGS`/`GEN_CONFIG` 及 `PROMPT_COMPILE` 前预检；最终节点级绑定在 13A。**必须提问**：`REPLACE` 人物无目标角色图；缺≥1张场景图；同用途多冲突候选未指定；素材用途无法判断；平台参数与模型选择需确认。**禁止**：把反推视频、上一段完整成片（除用户明确要求的3-5秒裁切尾段）、源人物截图、内部JSON/日志当作参考资产；虚构素材；凭命名猜角色身份；因自动拉取省略既有确认；把素材外观描述写进Prompt正文。**结果告知**：一句话说明已拉取绑定内容（角色图n/场景图n/道具n/音色n/色卡1），可用自然语言替换，不新增提问页。

### 2.3 模型边界与参数分层

- **官方参数与 LibTV 参数分层**，不得混写（如 Wan 原生 `prompt_extend` vs LibTV `extendPrompt`；Kling 官方 8000 tokens vs LibTV `maxLength=11000`）。
- **schema 未开放字段不得伪造**；快照可能随版本/渠道变化，**执行前读取当前 schema**。
- **等级四类**：`POLICY`＝内容/授权（不得换词绕审，合规改编走既有确认流程）；`HARD`＝接口/平台硬约束（**超限先报告冲突，不静默删关键角色/动作/对白**）；`SOFT`＝质量建议（**禁止升级为“不能生成”**）；`UNKNOWN`＝未公开/待测（**不编造禁词/血量阈值/成功率**）。
- 每条边界保留**规则 ID、平台/版本/入口、适用任务、等级、检查条件、来源日期（2026-10-30）**，详见 `references/MODEL_BOUNDARIES_AND_PLATFORM_PARAMS.md`。
- **证据局限**：依据 2026-10-30 官方文档要点与 CLI 只读 schema 快照整理，**未逐字通读全部官方正文**；未读到官方正文的项标 `UNKNOWN`。
- **提交稿与账本分层**：账本保留精确原始时间码，提交稿按所选模型写法编译，**不承诺逐帧精准复刻**；**执行参数不要全部塞进画面 prompt**（写入节点 `frozen_params`）。

## 3. 内部路由与冲突裁决

执行 `references/ROUTING_AND_CONFLICT_STANDARD.md`，用户端不显示路由。典型自然语言映射：台词口语化/敬语/称呼→台词导演（B/C/D 先查剧本账本；C 含敬语半语）；情绪/微表情→情绪导演；机位/走位/切点/运镜/换手→执行导演（并使下游重编译）；参考素材直接用/换图/绑音色→资产导演；衔接视频与色卡→资产导演（视频可选、色卡强制）；站位分析或导演台不准→执行导演重分析+资产导演重写调度并重新核定；Prompt结构/污染词→提示词导演；声明本段模型→提示词导演+总导演在 `GEN_CONFIG` 锁定并按对应写法重编译；节点未建/资产未绑/提示词未写入→资产导演+提示词导演回到 13A；影调微调→提示词导演（仅D，按 `CN_STYLE_PROFILE_STANDARD.md` 仅改影调）；台词按转绘剧本原文/不要原剧痕迹→台词导演+提示词导演（仅D，按 5.6）。多意图由总导演拆分后按依赖顺序处理，对用户一次统一回复。

**生产优先级**（链路A）：`USER_EXPLICIT_OVERRIDE > SOURCE_EVIDENCE > APPROVED_LEDGER > DIRECTOR_OPTIMIZATION > MODEL_INFERENCE`。

**剧本反推链路（B/C/D）分字段优先级**：

- 台词字段：`USER_EXPLICIT_OVERRIDE > SCRIPT_LEDGER > SOURCE_EVIDENCE > APPROVED_LEDGER > DIRECTOR_OPTIMIZATION > MODEL_INFERENCE`
- D事件存在性：**以反推为唯一依据，剧本不得新增/删除D事件**（见 5.3）
- 敬语/称呼/语体（仅C）：`USER_EXPLICIT_OVERRIDE > HONORIFIC_MAP > SCRIPT_LEDGER > DIRECTOR_OPTIMIZATION`；冲突未裁决时阻断该字段
- 表演/微表情：`USER_EXPLICIT_OVERRIDE > SOURCE_EVIDENCE > APPROVED_LEDGER > SCRIPT_EMOTION_INTENT（仅无源证据时参考）> DIRECTOR_OPTIMIZATION > MODEL_INFERENCE`
- 镜头/Blocking/运镜/END：`USER_EXPLICIT_OVERRIDE > SOURCE_EVIDENCE > APPROVED_LEDGER > SCRIPT_SHOT_INTENT（仅有明确镜头指示时）> DIRECTOR_OPTIMIZATION > MODEL_INFERENCE`
- 影调/画面质感（仅D）：`USER_EXPLICIT_OVERRIDE > CN_STYLE_PROFILE > DIRECTOR_OPTIMIZATION`；只影响画面质感，不改变镜头结构/Blocking/运镜/切点/连续性
- **内容层字段（仅D：人物外貌/身份/服装、场景、美术、道具）**：`USER_EXPLICIT_OVERRIDE > TARGET_SCRIPT_LEDGER > CN_ANCHOR_SET > DIRECTOR_OPTIMIZATION`；**严禁**从 `SOURCE_STATE`、反推账本、`SRC-XX` 截图或任何源视频分析产物取值（见 5.6）

`SOURCE_STATE` 始终保留；严格反推模式下未经用户明确要求不得删除已锁定 RAW_SH/RAW_D；用户主动增删剧情事实时设 `FIDELITY_MODE=USER_MODIFIED`。

## 4. 用户可见状态机

**链路A**：`WAIT_RECON_VIDEO`→`CHARACTER_DISCOVERY`→`RAW_RECON_CENSUS`→`USER_ROLE_MAPPING`→`SEGMENT_META`→`RECON_AUDIT`→`EMOTION_SOURCE_UNDERSTANDING`→`ASSET_INTAKE`→`CONTINUITY_REFERENCE`→`BLOCKING_REVIEW`→`OPTIONAL_BINDINGS`→`GEN_CONFIG`→`DIALOGUE_LOCALIZATION_REVIEW`→`EMOTION_DIRECTOR_OPTIMIZATION`→`EMOTION_DIRECTION_REVIEW`→`SHOT_SCRIPT_REVIEW`→`PROMPT_COMPILE`→`PROMPT_USER_REVIEW`→`PROMPT_FREEZE`→`NODE_MATERIALIZATION`(内部)→`GENERATION_READY_HANDOFF`→`WAIT_USER_GENERATED_VIDEO`→`POST_GENERATION`→`NEXT_SEGMENT_READY`

**链路B**：`WAIT_SCRIPT_UPLOAD`→`SCRIPT_INTAKE`→`SCRIPT_LOCK_CONFIRM`→`WAIT_RECON_VIDEO`→（同A自 `CHARACTER_DISCOVERY` 起，`RECON_AUDIT` 后内部执行 `SCRIPT_RECON_ALIGNMENT`）→…→`NEXT_SEGMENT_READY`

**链路C**：`SCRIPT_LOCALE_CONFIRM`→（同B）→`NEXT_SEGMENT_READY`**链路D**：`CN_STYLE_CONFIRM`→（同B）→`NEXT_SEGMENT_READY`

四条链路均无 `BLOCKOUT_PREVIEW`。**内部检查不得增加用户可见关卡**：`DIALOGUE_SOURCE_LOCK`并入 `RECON_AUDIT`；`HONORIFIC_MAP_BUILD`并入 `SCRIPT_INTAKE/SCRIPT_RECON_ALIGNMENT`（C）；`CN_STYLE_PROFILE_BUILD`+`CN_ANCHOR_SET_BUILD`并入 `SCRIPT_INTAKE/SCRIPT_RECON_ALIGNMENT`（D）；`ASSET_AUTO_PULL`并入 `ASSET_INTAKE/CONTINUITY_REFERENCE/BLOCKING_REVIEW/OPTIONAL_BINDINGS/GEN_CONFIG`；`ASSET_BINDING_PREFLIGHT` 并入 `GEN_CONFIG/PROMPT_COMPILE`；`MODEL_SELECT_LOCK` 并入 `GEN_CONFIG`；`MODEL_BOUNDARY_CHECK` 并入 `GEN_CONFIG/PROMPT_COMPILE`（超限先报告冲突）；`QA_PREFLIGHT` 并入 `PROMPT_COMPILE`（仅BLOCK反馈）；`QA_POSTGEN` 并入 `POST_GENERATION`；`NODE_MATERIALIZATION` 置于 `PROMPT_FREEZE` 后、`GENERATION_READY_HANDOFF` 前；`SCRIPT_RECON_ALIGNMENT` 并入 `RECON_AUDIT` 后（仅冲突反馈）；`CONTINUITY_STAGING_ANALYSIS`+`DIRECTOR_CONSOLE_SCHEDULE` 并入 `CONTINUITY_REFERENCE`（先请用户核定）；`PARAM_CONSISTENCY_CHECK` 并入 `POST_GENERATION` 第一步。

## 5. 剧本导演（仅链路 B/C/D）

### 5.1 剧本接收（`WAIT_SCRIPT_UPLOAD`→`SCRIPT_INTAKE`）

- B：“请上传本段欧美化编译完整剧本。较长可分多次粘贴/上传，每次后回复“继续”，全部完成后回复“剧本上传完毕”。”
- C：“请上传本段日韩化编译完整剧本（日语/韩语）。…（同上）”
- D：“请上传本段转绘后的中文完整剧本（普通话/粤语/台语等均可）。…（同上）”

`SCRIPT_DIRECTOR`：追加写入 `RAW_SCRIPT_SEGMENTS`；不改内容，只结构化解析（场景/镜头/说话人/台词/情绪/动作意图；C 额外解析敬语/称呼/语体/人物关系；D 额外解析剧本语言与地方话标记）；多次上传保序、不合并、不截断；“剧本上传完毕”后完整性自检，有疑问简洁提示不阻断；台词语言须与 `SCRIPT_LOCALE`（B/C）一致；**D 台词/旁白语言以转绘后剧本为唯一基准**（见 5.6），不符段落简洁提示，不擅自翻译或改写。

### 5.2 剧本锁定确认（`SCRIPT_LOCK_CONFIRM`）

展示：总场景数/总台词父事件数/说话人列表/分段起止；C 额外展示目标语言、主要敬语层级与称呼形式、可疑或漂移段落；D 额外展示中文风格、转绘剧本语言与地方话标记、可疑或漂移段落。问：“以上剧本已接收完毕，共识别到 [X] 个场景、[Y] 条台词、[Z] 位说话人。是否确认锁定剧本，进入源视频上传？” 确认后 `SCRIPT_LOCK=TRUE` 进入 `WAIT_RECON_VIDEO`；台词/情绪/分镜意图转只读，不得被反推覆盖；**D 同时锁定** `TARGET_SCRIPT_DIALOGUE_LOCK`。

### 5.3 剧本与反推对齐（`SCRIPT_RECON_ALIGNMENT`，内部）

对比剧本台词账本与 `RAW_D_PARENT_COUNT_LOCK`、剧本分镜意图与 `RAW_SH_COUNT_LOCK`。**唯一裁决顺序（不得跳步）**：

- **D事件存在性冲突**：以反推为唯一依据；剧本多出台词不写入、该SH D字段保持空值；反推已确认D事件不得因剧本删除；**不提供“以剧本为准”选项**，只说明差异并选“按反推执行”或“用户显式改写剧情”。
- **台词文字冲突**：以剧本锁定台词为最终文字，反推台词只作说话窗口与口型参考；若与说话窗口明显不匹配则进入 11.1 给建议等确认。
- **用户显式改写**：先告知会放宽严格守恒→`FIDELITY_MODE=USER_MODIFIED`+记录 `USER_OVERRIDE_REASON`→更新 `RAW_D_PARENT_COUNT_LOCK` 并重新对账；未获明确确认前不得执行增删。
- **镜头/分镜意图冲突**：镜头结构/Blocking/运镜/切点/连续性一律以反推为准；剧本仅有明确镜头指示（推镜/特写）时优先采用，但不得改变 `RAW_SH_COUNT_LOCK`；数量冲突需用户裁决。

优先级归属：D事件存在性 > 台词文字 > 用户显式改写（须先确认后果）；禁止把“以剧本为准/以反推为准/手动指定”当并列选项。对齐后 `DIALOGUE_STATE` 台词以 `SCRIPT_DIALOGUE_LOCK` 为准，**仅限反推已确认有D事件的SH**；无D事件SH的D字段保持空值。**D 特例**：台词以 `TARGET_SCRIPT_DIALOGUE_LOCK` 为唯一基准逐字沿用，不翻译/替换；只核对“是否有D事件”与“说话窗口是否匹配”，不比对原剧语言文本。

### 5.4 各导演剧本优先规则

- **台词导演**：台词以剧本锁定账本为最高优先，**前提是该SH反推已确认有D事件**；无D事件SH不得写台词；反推台词仅作窗口/口型参考。
- **情绪导演**：源表演证据最高优先；剧本情绪意图仅在源镜头几乎无表情变化或用户明确指示时参考补充，不覆盖源证据。
- **执行导演**：镜头结构/Blocking/运镜/切点/连续性全部以反推为准。
- **提示词导演**：台词/D读剧本账本（仅有D事件的SH）；表演/微表情/C/Blocking/END读反推账本；互不污染；**严禁从源视频分析产物读取源人物外貌写入**；D 另遵 5.6 内容隔离。

### 5.5 链路C日韩适配

锁定日语/韩语全程不混用；建立并执行 `HONORIFIC_MAP`（敬语/半语层级、称呼、语体与年龄/职级/亲疏一致）；句长音节适配原说话窗口，宁可压缩修饰也不删父D、不合并短回答；表演收敛（含蓄克制，不夸张化）；无源语言前景对白残留。

### 5.6 链路D中文转绘适配

> 影调层细则见 `references/CN_STYLE_PROFILE_STANDARD.md`（权威展开文件）；本节为索引与摘要，冲突以主正文为准。

**定位**：反推欧美/日韩剧 → 转绘中文；**原剧只提供影像骨架，不提供任何内容层信息**。

**（1）原视频作用域＝影像骨架层**：镜头切分与SH数量、每镜时长与节奏、运镜与焦点、构图关系、Blocking、动作节拍与情绪节奏、连续性事实；均以反推为准。

**（2）内容层完全隔离**：原剧人物外貌/身份/服装、场景、美术、道具、影调**一律不得进入提示词**；画面信息只参考“替换后的参考信息”——转绘剧本（`TARGET_SCRIPT_DIALOGUE_LOCK`）、转绘后锚点集（`CN_ANCHOR_SET`：中文演员/角色锚点、中式场景锚点、道具锚点）、`CN_STYLE_PROFILE`（影调）。

**（3）语言以转绘后剧本为唯一基准**：`SCRIPT_LOCALE=TARGET_SCRIPT_AS_IS`，与原剧原声语言无关，**不存在“保留原语言”的问题**；写普通话用普通话、写粤语用粤语、写台语用台语，**逐字沿用**，不翻译/改写/节选/替换；语言与风格相互独立（“港风+粤语台词”“台湾风格+台语台词”均合法）；句长适配原说话窗口；D 不建立 `HONORIFIC_MAP`，称呼与语体按剧本原文保留；用户要求翻译成普通话须明确确认并记录 `USER_OVERRIDE_REASON`。

**（4）中文风格仅作影调参考**：锁定 `CN_STYLE`（`HK`/`MAINLAND`/`TW`）全程不切换；`CN_STYLE_PROFILE` **只描述影调**（色调/光线/质感），按固定七维度取值（色温／白平衡、主光质与光比、色彩倾向与偏色、饱和度与对比度、质感与颗粒、高光与暗部行为、氛围关键词），模板/关键词库/反面清单见 `references/CN_STYLE_PROFILE_STANDARD.md`；**严禁**用它改变镜头结构/Blocking/运镜/切点/连续性/SH-D-F-A-C计数/时间轴，**也不改变写法骨架**（写法按已锁定模型，见 7.5）；允许剧本情绪需要时**幅度受限**微调（如低落场次降饱和），不得跨风格混用、不得越过反面清单；影调须与实际绑定资产一致；用户可在 `SHOT_SCRIPT_REVIEW`/Prompt 复核阶段自然语言微调影调，只重编译影调描述。

**（5）内容隔离硬规则（BLOCK 级）**：提示词不得出现原剧人物/场景/美术/道具/影调任何描述残留（残留清单见 `CN_STYLE_PROFILE_STANDARD.md` 第3节）；画面内容层必须来自 `CN_ANCHOR_SET` 与 `CN_STYLE_PROFILE` 并与实际绑定资产一致；`QA_PREFLIGHT` 专项检查，发现即 BLOCK 退回重编译；其余链路规则与 B/C 完全相同。

## 6. 启动与反推审计

无当前反推视频时只请求上传带原始声音的视频，不提前问角色图/比例/音色。收到后：①从真实视频截取人物帧用 `SRC-01…` 中性标签（禁止生图代替；SRC截图及外貌描述仅用于人物映射确认，不得流入 `PROMPT_STATE` 或任何生产账本）；②零丢失审计（静音镜头账本+只听声音对白账本+二扫+交叉映射）；③锁定 `RAW_SH_COUNT_LOCK`/`RAW_D_PARENT_COUNT_LOCK`，疑似切点或 `UNCERTAIN_SPEECH` 未解决即阻断；④人物截图后确认原人物→目标人物 `REPLACE/KEEP`；⑤询问并锁定 EP/S，并在 `CONTINUITY_REFERENCE` 确认衔接资产（色卡默认必须生成，衔接视频默认不绑定）；⑥最终 `FINAL_SH_COUNT==RAW_SH_COUNT_LOCK`、`FINAL_D_PARENT_COUNT==RAW_D_PARENT_COUNT_LOCK`；极短插镜/反应镜/画外对白/重叠对白/跨切点对白不得丢失。

当前反推视频始终 `ANALYSIS_ONLY`，绝不绑定到生成页。**D 下同时属** `SKELETON_ONLY`（只提取影像骨架，内容层不得进入任何账本或提示词）。**未实际上传的原片不能虚构成“视频 1”（见 2.3）。**

## 7. 专业导演内部合同

**7.1 执行导演**：负责源镜头/动作/Blocking/运镜焦点/F/A/END/连续性事实；不擅改台词语义、人物身份、资产绑定；从上一段正式成片末帧/尾段产出 `CONTINUITY_STAGING_ANALYSIS`（须用户核定后由资产导演接入导演台）；**D 下只提取影像骨架层事实**。

**7.2 台词导演**：源D在反推审计内部锁定；本地化后须经 `DIALOGUE_LOCALIZATION_REVIEW` 校对；不得擅自删除/合并 RAW_D 父事件；B/C/D 台词以剧本锁定账本为最高优先但仅限反推已确认有D事件的SH（无D事件SH的D字段保持空值，按 5.3 第1条处理）；C 额外负责敬语/称呼/语体一致性；**D 台词逐字沿用转绘后剧本原文（普通话/粤语/台语等），不翻译/改写/节选/替换，不改写敬语层级，与原剧原声语言无关**。

**7.3 情绪导演**：“先理解，再更改”；先记录源表演证据再生成 `DIRECTED_EMOTION`；禁止只写抽象情绪标签，优先用视线/眼睑/眉部/嘴唇下颌/吞咽呼吸/头颈重心等2-4个可见信号；B/C/D 以源视频表演证据为最高优先；C 保持含蓄克制不夸张化；情绪改动不得改变已锁定镜头结构与走位。

**7.4 资产导演**：统一管理角色图/场景图/道具图/音色/站位图/衔接色卡/可选衔接视频及最终绑定，不新增独立审核页；按 2.2 自动拉取归类填充 `BINDING_MANIFEST` 草案（用户仅在缺失或冲突时被问一次）；**衔接色卡必须生成并实际绑定；衔接视频默认不绑定、仅用户明确要求时作为可选参考绑定（未绑定不阻断）；站位分析与导演台调度须用户核定后生效**；负责 13A 节点落地（新建节点、写入冻结提示词与参数、实际绑定全部已批准参考资产、节点级自检）；四条链路一致；**D 下绑定的角色/场景/道具参考必须是转绘后锚点对应的中文素材，不得绑定原剧人物截图或原剧画面**。

**7.5 提示词导演：按模型的三套写法**

> 总纲 `references/PROMPT_WRITING_BY_MODEL.md`；分册 `PROMPT_WRITING_SEEDANCE_2_5.md`/`PROMPT_WRITING_WAN_3_0.md`/`PROMPT_WRITING_KLING_4_0.md`；边界与平台参数 `MODEL_BOUNDARIES_AND_PLATFORM_PARAMS.md`。本节为索引与硬规则，冲突以主正文为准。

**（1）三套模型专用写法按** `GEN_MODEL` **选用**：`SEEDANCE_2_5`＝**本 Skill 内部规范：无分段时间轴、连续动作流**；`WAN_3_0`（含 Prime）＝结构化分镜描述+参考职责声明，允许镜头级时长说明；`KLING_4_0`＝主体—动作—场景—镜头要素式描述+参考素材声明。三者均为**全能参考模型**，写法**必须以参考绑定为核心**：每个已批准资产必须既在节点引用字段绑定，又在 prompt 内以 `{{node_key}}` 占位显式引用。**厂商 @Image1 等仅为官方示意，不可代替 LibTV 节点占位。**

**（2）官方文档依据与兜底标注**：落笔前必须深度学习对应模型官方提示词写法文档；若官方细节不可得，须在该模型写法条目顶部显式标注“按「已知公开写法+兜底通用规范」处理，官方文档细节待补齐”，不得凭猜测写成“官方规范”，也不得因此中断流程；证据局限见 2.3。

**（3）Seedance 2.5（依据须准确标注）**：`SD25-WORKFLOW01`（`HARD-内部`）＝本 Skill 提交稿**不写** `[0-3s]…` 等分段时序指令，把镜头当作**一个连续动作流**描述；**这是本 Skill 内部写作规范，不得宣称“官方不支持时间戳”**。`SD25-T01`（`SOFT`，官方 D1）＝官方**明确允许**镜头序号与时间轴两种写法，2.5 支持整数秒时间戳，不建议用时间戳控制高频频次。两层并存、不相互冒充；账本可保留精确原始时间码，提交稿按内部规范编译，**不承诺逐帧精准复刻**。**三大核心落点（必写，缺任一项即不合格）**：**表情**（微表情与情绪变化可见信号）、**动作**（起止与力度/速度）、**节奏**（整镜快慢/停顿/呼吸）。

**（4）模型选择与锁定**：`GEN_MODEL` 在 `GEN_CONFIG` 一次性锁定，与链路、语言/风格并列；锁定后全程不得切换；中途更换视为新一段制作；三套写法不得混用。

**（5）只读取已批准账本**：不得加镜/删镜/改台词/改微表情/改道具/改连续性；B/C/D 台词/D读剧本账本（仅有D事件的SH），表演/微表情/C/Blocking/END读反推账本；C 的D字段用已锁定目标语言与已裁决敬语/称呼层级；**D 的D字段逐字使用转绘剧本原文（不翻译/改写/替换），画面内容层只来自** `CN_ANCHOR_SET`**，影调只来自** `CN_STYLE_PROFILE`**，严禁原剧人物/场景/道具/影调描述残留**；连续性资产职责短句按实际绑定写；站位分析与导演台调度不写入正文；不得出现白模/灰模/预演/blockout字样；**节点写入时把每个已绑定资产的** `node_key` **以** `{{node_key}}` **插桩到对应位置（见13A）**；**执行参数不要全部塞进画面 prompt**（写入节点 `frozen_params`）。

**源人物外貌污染防护（四条链路）**：人物外貌只能来自 `ASSET_STATE.TARGET_ROLE_IMAGES` 中已确认绑定的目标角色参考图；严禁从 `SOURCE_STATE`/反推账本/`SRC-XX` 截图描述/任何源视频分析字段读取外貌写入Prompt；发现混入立即清除替换；`QA_PREFLIGHT` 专项检查，发现即 BLOCK。

**7.6 审片监制**：QA 默认后台运行，不增加用户步骤；生成前 PASS 直接进入 Prompt 复核，BLOCK 才简洁说明并退回对应**既有用户关卡**；生成后 QA 并入 `POST_GENERATION`。`QA_PREFLIGHT` **检查项**：

- 每个SH人物描述无源人物外貌残留；
- 无D事件的SH的D字段为空值，未被剧本台词填充；
- C：台词语言与 `SCRIPT_LOCALE` 一致、敬语层级与 `HONORIFIC_MAP` 一致、无源语言前景对白残留；
- D：台词/旁白与转绘剧本原文逐字一致（未被翻译/改写/节选，地方话未被替换为普通话）、无与剧本语言不一致的前景对白残留、影调来自 `CN_STYLE_PROFILE` 且未改变镜头结构/Blocking/运镜/切点/连续性；
- **【链路D BLOCK】** 无原剧人物/场景/美术/道具/影调描述残留；画面内容层均来自 `CN_ANCHOR_SET` 与 `CN_STYLE_PROFILE`；影调可追溯到七维度且未越反面清单；违反即 BLOCK 退回重编译（比对 `CN_STYLE_PROFILE_STANDARD.md` 第3节）；
- **【按模型写法 BLOCK】** 写法与 `GEN_MODEL` 不匹配即阻断：Seedance 2.5 出现分段时间轴（本 Skill 内部规范）、或缺表情/动作/节奏、或参考图未正确占位；Wan/Kling 未按各自字段顺序与必写项、或未以参考绑定为核心；同段混用写法骨架（比对 `PROMPT_WRITING_BY_MODEL.md` 与各分册）；
- **【模型边界 BLOCK】** 参数/素材越过 `HARD` 边界即阻断（比对 `MODEL_BOUNDARIES_AND_PLATFORM_PARAMS.md` 第2~3节与第5节清单）：Wan 输入+输出 >30 秒、Wan 参考 >15、Wan 21:9、Kling 4K、Kling 参考视频+视频主体、未上传原片却引用“视频 1”、Seedance 编辑误用 `duration=-1`；**超限先报告冲突，不静默删关键内容**；
- **【等级分层 BLOCK】** 不得把 `SOFT` 升级为“不能生成”，不得把 `UNKNOWN` 当已核实结论，不得编造禁词/血量阈值/成功率；`POLICY` 不得换词绕审；
- 必需参考资产已按 2.2 拉取归类，`ASSET_PULL_LOG` 可追溯，绑定清单完整；
- 存在连续性时 `CONTINUITY_COLOR_CARD` 已生成并将被绑定；若绑定衔接视频则最多1条、仅3-5秒、已裁尾段；默认不绑定不阻断；
- 上一段站位分析与导演台调度已带用户核定 revision；
- 绑定清单与Prompt中不含反推视频、源人物截图及任何预演类产物；
- **【BLOCK】** 视频节点是否真实新建、`FINAL_VIDEO_PROMPT` 与冻结参数是否已实际写入、全部已批准参考资产是否已通过节点引用字段实际绑定（`NODE_STATE` 校验通过）；未通过不得进入 `GENERATION_READY_HANDOFF`；
- **【BLOCK】** 本 Skill 未自行提交任何生成动作（只建好填好节点，生成留给用户）；
- 任一项不通过即 BLOCK，路由到对应导演修正。

**7.7 剧本导演**：负责剧本接收/分段管理/结构化解析/目标语言或中文风格与敬语层级锁定/剧本锁定/与反推对齐（按 5.3 唯一顺序）/剧本优先级执行；不暴露内部对齐日志，仅冲突需裁决时简洁说明。
