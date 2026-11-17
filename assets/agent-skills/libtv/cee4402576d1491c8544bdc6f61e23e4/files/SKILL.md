---

name: brand-promo-video-generator\
description: For operators and creators building promo content for brands, products, websites, apps, small shops, or personal projects. Users provide a logo, product images, interface screenshots, an official link, or just a creative brief; the Skill runs brand fact assembly, narrative direction matching, exact beat planning, and motion-language design, then outputs ready-to-paste video prompts plus an infinite-canvas node plan. Beat density follows a fixed standard (5s -&gt; 1-2 core beats, 10s -&gt; 2-4, 15s -&gt; 5-8, 30s -&gt; 8-12) and extrapolates for longer runtimes. When the requested duration exceeds a single clip, the Skill designs the seam between segments automatically and schedules the matching number of canvas video nodes so the assembled cut lands exactly on the requested total length. Covers launch films, website showcases, social promotion, and long-form narrative pieces up to several minutes. Does not imitate real brand marks without authorized assets, invent product claims, or fabricate metrics.\
allowed-tools:

- webfetch
- hub_image_search
- hub_analyse_media
- hub_canvas_get_node
- hub_canvas_group_recent_outputs
- hub_generate_image
- hub_generate_video
- hub_generate_audio
- hub_generate_music
- hub_synthesize_speech
- hub_video_edit
- hub_audio_meta
- task

---

# 品牌宣传短片提示词生成器

把一个品牌诉求，变成一组**节拍精确、分段可衔接、时长可加总**的成稿视频提示词，外加一份无限画布节点编排方案。

适用对象：品牌、产品、网站、App、小店、个人项目。\
输入可以是 LOGO、产品图、界面截图、官网链接，也可以只是一句创意诉求。\
输出是可直接粘贴提交的提示词正文 + 节点计划，不是"再讨论一下方向"。

---

## 0. 核心承诺（不可妥协的六件事）

1. **节拍有标准**：任何时长都映射到明确的核心节拍区间，不靠感觉。
2. **时长可加总**：诉求几秒，成片就几秒；分段时长之和必须精确等于总时长，零误差。
3. **衔接有设计**：超过单段上限时，段与段之间的接缝必须是设计出来的，不是撞出来的。
4. **节点有数量**：画布上放几个视频节点、每节点多少秒、谁接谁，必须写死。
5. **提示词即成品**：正文直接可提交，不存在"此处待补充"。
6. **事实不编造**：品牌标识、产品名、功能、数据、口号，只能来自可核验来源或用户原件。

---

## 1. 工具覆盖与降级规则

本技能的完整生产承诺需要：素材检索、图像准备/生成、视频片段生成、可选语音/音乐、最终剪辑合成、媒体检查、画布分组。

- 若运行时**全部具备** → 走完 STEP 11 直接派发，产成片 + 提示词包。
- 若运行时**只有生成类工具、没有剪辑合成** → 仍然输出全部提示词与节点计划，并在交付说明中标注「需在外部剪辑工具中按节点顺序拼接」。
- 若运行时**只有语言能力** → 降级为**纯提示词交付**，这是本技能的合法交付形态之一，不视为失败。须明确告知：提示词已可直接提交，节点计划供手动排布。

任何情况下都不允许"因为没法生成所以含糊其辞"。提示词永远给全。

---

## 2. 总流程

```
STEP 1  素材征集与需求确认      → references/01-intake-and-brief.md
STEP 2  品牌事实表              → references/02-brand-truth-and-provenance.md
STEP 3  溯源清单                → references/02-brand-truth-and-provenance.md
STEP 4  叙事方向匹配            → references/03-narrative-spines.md
STEP 5  节拍规划（时长→节拍）    → references/04-beat-planning.md
STEP 6  分段规划（时长→段数）    → references/05-segmentation-and-chaining.md
STEP 7  衔接设计（段与段接缝）   → references/05-segmentation-and-chaining.md
STEP 8  动效语言与音频策略       → references/07-motion-and-audio.md
STEP 9  提示词生成（六段式正文） → references/06-prompt-format-h3.md
STEP 10 画布节点编排             → references/08-canvas-node-plan.md
STEP 11 硬确认门 → 派发
STEP 12 自检与交付               → references/09-qa-and-delivery.md
```

STEP 1–4 可合并成一轮对话完成。STEP 5–7 必须由脚本或等价手算完成，不允许目测。\
STEP 9 是本技能的主产出。STEP 10 是执行层。STEP 11 不可跳过，但**只需一次确认**。

---

## STEP 1 · 素材征集与需求确认

开场一次性问清，不要挤牙膏。必问五项：

项说明缺省处理素材LOGO / 产品图 / 界面截图 / 包装 / 官网链接 / 影片缺失则问，不猜总时长秒数。5/10/15/30 秒为常见档，&gt;30 秒自动进分段流程未指定时按 15 秒画幅16:9 / 9:16 / 1:1 / 4:3 / 3:4未指定时按 16:9叙事语言旁白与画面文字语言依品牌素材语种判定，不依聊天语种推广重点卖点、场景、行动号召、必须出现的信息缺失则先提 2 版假设请其择一

**权利问题不重复追问。** 用户上传的素材默认可用于前期与概念规划。只有出现具体风险信号时（可见第三方水印、明显抓取的电商图、用户表述自相矛盾、医疗/金融/法律类合规宣称、明确要求商用投放），才问一次授权。来源统一记为「user-provided」，在溯源清单里标注提示，而不是卡住流程。

**语言判定规则**：看品牌素材、官网文案、目标受众与投放平台，不看用户在哪个语言环境里提问。品牌素材以英文为主 → 旁白与画面文字默认英文；用户明确要求中文本地化 → 中文。对话语言与成片语言可以不同，这是正常的。

**身份型素材（LOGO、产品 UI、吉祥物、包装、字体、人物）无法核实来源时**：停下，要授权原件，不要生成形似替代品。

---

## STEP 2 · 品牌事实表

按可信度顺序取材：

1. 用户提供的原件导出
2. 官网 / 新闻室 / 品牌门户 / 媒体资料包 / 官方仓库
3. 公司自营媒体库
4. 已授权图库或合作方素材包

抽取并落表：

- LOGO 的准确版本、安全边距、禁用方式
- 官方字体或可观察到的排版行为
- 主色、辅助色、动态色（给出具体色值）
- 品牌语气、原则、视觉母题、交互语言
- 当前产品名、功能清单、使用场景、可公开数据、口号、行动号召、免责声明
- 官方摄影、渲染图、界面截图、影片、媒体资料

**禁止**把聚合站、搜索缩略图、粉丝再创作、Pinterest 转发、AI 替代图当作身份型素材来源。\
程序化图形只允许作为**非具象动效层**：遮罩、渐变、色场、栅格、辉光、粒子、拖尾、字体、可核验数据图表、转场几何。

---

## STEP 3 · 溯源清单

每个身份型素材一条记录，交付时随片附上：

```
asset_id | 角色 | 本地路径或画布节点 | 来源 URL/说明 | 来源类型 | 核验比对目标 | 权利/发布提示 | 状态
```

状态取值：`verified` / `user-supplied` / `licensed` / `blocked`。\
清单本身不授予发布权。授权状态不明时，成片标注为「非官方概念片」，并告知商用需取得许可。

---

## STEP 4 · 叙事方向匹配

用户已定方向则直接进 STEP 5。未定则给 2–3 个方向、推荐其一、确认后继续。\
按品类选脊柱（完整脊柱库见 `references/03-narrative-spines.md`）：

品类脊柱骨架AI / SaaS用户意图 → 思考规划 → 能力展开 → 执行 → 有用产出 → 证明 → LOGO实体产品主角揭示 → 上手交互 → 功能微距 → 使用场景 → 结果 → LOGO服务 / 公司背景 → 流程 → 证据 → 结果 → 承诺 → LOGO影像型品牌真实影像 → 视觉母题 → 利益点 → 情绪落点 → LOGO小店 / 本地门面氛围 → 招牌产品特写 → 制作过程 → 人与人的瞬间 → 地址与营业信息个人项目动机 → 方法 → 作品细节 → 影响 → 署名

故事必须落到产品本身：真实功能、真实交互、真实场景、真实产出。不要用抽象特效盖住"这产品到底能干什么"。

---

## STEP 5 · 节拍规划

规划单位统一 **30fps**。先定节拍数，再定时长分配。

### 5.1 节拍标准（硬标准）

目标时长核心节拍数密度（节拍/秒）3 秒10.33**5 秒1–2**0.20–0.40**10 秒2–4**0.20–0.40**15 秒5–8**0.33–0.5320 秒6–90.30–0.45**30 秒8–12**0.27–0.4045 秒10–150.22–0.3360 秒11–170.18–0.2890 秒14–230.16–0.26120 秒17–280.14–0.23180 秒23–390.13–0.22

> 超过 30 秒按同一衰减曲线外推：`下限 = 8 + 0.10 × (T − 30)`，`上限 = 12 + 0.18 × (T − 30)`，四舍五入取整。\
> 表内加粗四行为用户指定标准，不得改动；其余为其合法外推。

### 5.2 节拍与镜头的区分

- **核心节拍（major beat）**：一个完整信息单元 = 一个主动作 + 一条信息 + 一次视觉重心转移。
- **镜头（shot）**：节拍内的一次运镜或构图单位。**1 个核心节拍含 1–3 镜。**

120 秒片 = 17–28 个核心节拍 = 约 40–80 镜。节拍数是"叙事台阶数"，不是"剪辑次数"。

### 5.3 每个节拍必须填满八列

列内容时间`mm:ss–mm:ss`（禁止 `01:70` 这类写法）+ 帧范围视觉归属该节拍由谁主导：LOGO / 产品 / UI / 人物 / 抽象动效 / 数据图素材 ID引用溯源清单里的 asset_id，或标注 `procedural`主动作一句话，只写一个动作证明点这一镜展示了什么产品事实文字画面文字 + 可读停留时长（≥ 1.2 秒）色态属于哪一档色态（全场 2–5 档，见 STEP 8）进出转场 + 运动意图setup / anticipation / commitment / impact / brake / settle

### 5.4 15 秒黄金骨架（可直接套）

`品牌钩子 → 用户意图 → 产品机制 → 能力/场景 → 产出或证明 → 产品收益 → LOGO + 行动号召`（7 节拍）

20–30 秒在此骨架上加：多一个使用场景 + 一条可核验数据 + 一次情绪停顿。\
超过 30 秒：不拉长单节拍，而是**在骨架上叠第二个叙事循环**（见 `references/04-beat-planning.md` 的「双环结构」）。

---

## STEP 6 · 分段规划

单段上限取自当前视频模型的单次生成上限，默认 **15 秒**（H3 系列按此值）。

```
段数 N = ceil(总时长 T / 单段上限)
```

总时长段数每段典型时长≤ 15 s1全长16–30 s28–15 s + 8–15 s31–45 s310–15 s 各段46–60 s411–15 s 各段61–75 s512–15 s 各段76–90 s612–15 s 各段91–105 s713–15 s 各段106–120 s813–15 s 各段

**硬约束**：

1. `Σ 各段时长 = 总时长`，误差 0 秒（按帧核，末段吸收余数帧）。
2. 段边界必须落在**节拍边界**上，不许切在动作中段。
3. 每段至少 1 个核心节拍，且不超过该段时长对应的节拍上限（15 秒段 ≤ 8 节拍）。
4. 每段至少 3 秒，禁止切出 1–2 秒的碎片段。

分段算法与核算表见 `references/05-segmentation-and-chaining.md`，或直接运行：

```bash
python scripts/plan_promo.py --duration 47 --max-seg 15
```

输出：节拍区间、段数、每段起止帧、每段节拍配额、衔接建议。**这张表就是后续提示词的时间契约。**

---

## STEP 7 · 衔接设计

超过 1 段时必须为每个接缝指定一种衔接法，并写进相邻两段的提示词。

衔接法适用条件提示词写法**Frame Chain 尾帧续接**连续动作、连续运镜、同一空间段 N 末尾指定 `out-point state`；段 N+1 以该帧为首帧（FL2VA/I2VA），首句复述同一状态**Match Cut 动作匹配**动作方向或速度可延续段 N 收尾动作方向/速率 = 段 N+1 起手方向/速率，构图重心同侧**Bridge 动效桥接**空间跳转、时间跳跃段尾 0.4 秒光晕横扫/色块擦除/失焦；段首 0.4 秒同款反向展开**Reverse Push 反向推拉**需要"呼吸感"换场景段 N 推近收，段 N+1 同构图拉远起**Sound Bridge 声音桥**视觉必须硬切但听觉要连续BGM 节拍与混响跨段不中断，视觉直接切

优先级：Frame Chain &gt; Match Cut &gt; Bridge &gt; Reverse Push &gt; Sound Bridge。\
能续帧就不要靠转场遮。

衔接的写法模板与四类接缝的完整示例见 `references/05-segmentation-and-chaining.md`。

---

## STEP 8 · 动效语言与音频策略

### 动效

- 由产品运动、光标路径、界面流、光线、滚动内容、物体边缘、匹配几何来驱动转场
- 全场 **2–5 档色态**，每档绑定一个叙事含义（冷静 / 激活 / 高潮 / 落地）
- 每节拍一个主动作，次级图层延迟入场
- 设 2–3 个高能峰 + 若干"刹车"停顿，峰与峰之间必须落
- 保住可读剪影、画面文字、LOGO 安全边距
- 禁止：假 HUD、无来由的玻璃卡片、装饰性文字墙、未核实指标、全场同一条缓动曲线

**防虚影三律**（所有运镜词必须满足）：

1. 运镜只能写 `slow / steady / gradual / constant gentle speed`，禁 `fast / rapid / whip / spin` 类词。
2. 每个镜头都必须有微动：人物手势、交谈、举杯，烛火摇曳，窗帘呼吸，水面涟漪，界面光标呼吸。定镜也要微动，禁止"幻灯片感"。
3. 一镜到底需求必须显式声明 `no hard cuts`，分镜仅作节拍标记。

**画面质感**：`photorealistic live-action / 35mm film grain / soft halation / gentle vignette / warm color science`，写入提示词文件头的 FILM STYLE 块。

### 音频

默认走**视频原生音频**：开启 `generate_audio`，在提示词里写清 brand-safe 器乐配乐与 UI 音效设计。

只在下列情况才单独生成语音或音乐：用户明确要可控旁白、要可替换独立 BGM、音乐时长需独立于画面、需要后期混音、或所选视频模型产不出可用音频。

**同一条音轨不要双份**：原生音频与单独音频二选一。字幕仅在用户明确要求时加。

---

## STEP 9 · 提示词生成

每段一份独立提示词文件。正文**全英文**，六个固定段落，顺序不可调换：

```
subject_definitions
summary
retention_analysis
detailed_description
overall_soundscape
non_diegetic_music
```

文件头另起区块，逐条整段单行：

```
MODE            （T2VA / I2VA / FL2VA / L2VA / Ref2VA）
DURATION        （本段秒数 + 帧数）
SEGMENT         （i of N）
GLOBAL TIMELINE （本段在总时长中的起止 mm:ss）
IN-POINT STATE  （首帧状态；续接时写"承接上一段末帧"）
OUT-POINT STATE （末帧状态；供下一段续接）
LINK            （本段与上一段/下一段的衔接法）
AUDIO NOTE
CAMERA RULE         防虚影三律第一条
LIVING-SCENE RULE   防虚影三律第二条
FILM STYLE
```

**两套时间坐标不要混用**：`GLOBAL TIMELINE` 用全局时间（00:00.0 = 全片第一帧）；`detailed_description` 每镜的时间戳用**段内相对时间**（00:00.0 = 本段第一帧），到本段 DURATION 结束，绝不写全局时间。

排版硬规则：**不做手动断行**。每个字段、每个标签、每段说明各占一整行；句子不按列宽硬换行。`subject_definitions` 每条一行，`summary` 一整段一行，`detailed_description` 每镜一整段一行。整个文件只有三类内容可分行：字段名行、上传顺序清单条目、`====` 分隔线。

完整骨架与逐段范例见 `references/06-prompt-format-h3.md` 与 `assets/prompt-skeleton.md`。\
生成后运行自检：

```bash
python scripts/validate_prompt.py <prompt.txt> --total 47
```

---

## STEP 10 · 画布节点编排

按段数在无限画布上排节点，**从左到右即时间顺序**：

```
[TXT] 00_brief ─ [TXT] 01_brand_truth ─ [TXT] 02_provenance
[IMG] S1_keyframe ─ [VID] S1 ─ [TXT] S1_prompt
                    [VID] S2 ─ [TXT] S2_prompt
                    [VID] S3 ─ [TXT] S3_prompt
                                        [VID] FINAL_concat
```

命名：`PROMO_<BRAND>_<TOTAL>s_S<i>of<N>_<t0>-<t1>`

- 视频节点数量 = 段数 N，一个不多一个不少
- 每段下方挂其提示词文本节点，便于追溯与重跑
- 最终 concat 节点置于最右，标注总时长与总帧数
- 全部输出归入同一 group
- 帧数按整数分配，余数帧并给末段，保证 `Σ帧 = 总时长 × 30`

节点计划表的完整字段与排布规则见 `references/08-canvas-node-plan.md`。

---

## STEP 11 · 硬确认门

派发（生成图像/视频/语音/音乐/剪辑）之前，把前置包一次性摊给用户：

- 品牌事实表（摘要）
- 溯源清单
- 选定的叙事方向
- 节拍表（逐节拍八列）
- 分段表（N 段、各段起止、节拍配额、衔接法）
- 画布节点计划
- 可见文字、行动号召、旁白与音频方案
- 已知的真实性、权利、占位说明

出现「确认 / 可以 / 继续 / 下一步 / 生成 / 没问题 / go ahead / confirm / proceed」即视为通过。要求修改则改完再确认。

用户说"跳过流程直接出"时，仍然先给一份压缩版（事实摘要 + 节拍表 + 分段表），再走。

---

## STEP 12 · 自检与交付

交付前逐条过（完整清单见 `references/09-qa-and-delivery.md`）：

- LOGO 与身份型素材来自已核验或用户授权来源
- 产品名、功能表述、数据、口号、行动号召与官方来源一致，或明确标为概念文案
- `Σ 各段时长 = 诉求总时长`，帧级零误差
- 段边界落在节拍边界上，无 1–2 秒碎片段
- 每个接缝都有指名衔接法，相邻两段提示词互相引用首/末帧状态
- 画布视频节点数 = 段数，命名与时间区间一致
- 时长、画幅、语言与需求一致
- 画面文字可读、不拥挤（每镜 ≤ 12 字，停留 ≥ 1.2 秒）
- 提示词符合六段式、防虚影三律、不手动断行
- 多素材输出已分组

交付内容：提示词文件（每段一份）+ 节拍表 + 分段表 + 节点计划 + 溯源摘要 + 时长核算 + 下一轮的具体优化建议（节奏、卖点清晰度、行动号召、音频、平台裁切）。

---

## 失败恢复

症状处理LOGO 走形或不像删掉，找回当前官方文件或索取原件，重出；绝不修饰仿制品产品/界面看着假换成官方、用户提供或已授权素材；不要打磨仿制品好看但空泛补一个完整产品交互、一条可核验事实或一次真实产出快但乱减少同帧动作数，明确视觉归属，保住跨切的匹配运动顺但拖缩短停留、叠化转场，只在高信息点刹车分段接不上先试 Frame Chain；不行退 Match Cut；再不行加 Bridge；最后才靠声音桥时长对不上回 STEP 6 重算，不许靠"剪辑时再拉一拉"长片后半段塌补第二个叙事循环，不要靠延长镜头撑时间素材不可得索取授权原件，不猜

---

## 参考文件索引

文件用途`references/01-intake-and-brief.md`素材征集话术、需求确认表、缺省值`references/02-brand-truth-and-provenance.md`事实表字段、素材可信度分级、溯源清单`references/03-narrative-spines.md`六类品类脊柱 + 九种风格方向`references/04-beat-planning.md`节拍推导、双环结构、八列模板、逐档范例`references/05-segmentation-and-chaining.md`分段算法、时长核算、五类衔接、接缝范例`references/06-prompt-format-h3.md`六段式规范、文件头、逐段写法、常见扣分点`references/07-motion-and-audio.md`动效语言、色态系统、音频决策树`references/08-canvas-node-plan.md`节点计划表、排布规则、命名与分组`references/09-qa-and-delivery.md`交付前检查表、交付话术、返修建议`assets/beat-sheet-template.md`节拍表空白模板`assets/segment-plan-template.md`分段表空白模板`assets/prompt-skeleton.md`提示词骨架与填法`assets/provenance-manifest-template.md`溯源清单模板`examples/walkthrough-47s.md`47 秒片全链路对照（节拍→分段→接缝→节点→核算）`examples/S2_11.5-23.5.txt`成稿提示词范例（多段片的第 2 段）`scripts/plan_promo.py`时长→节拍→分段 规划器`scripts/validate_prompt.py`提示词自检器