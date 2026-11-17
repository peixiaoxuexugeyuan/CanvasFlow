# 安装与使用说明 · 动作导演 Skill（Fight Prompt Director）

## 一、这是什么

`fight-prompt-director`（中文名：**动作导演**）是一个面向 **AI 视频生成**的动作戏提示词编排 Skill。

它把角色、场景、图片、首尾帧或分镜素材，整理成**可直接复制使用的视频提示词**，重点解决：

- 动作**因果链**（谁发起 → 指向哪里 → 接触/格挡/落空 → 对方回应 → 位置变化 → 下一拍接口）
- **角色差异**（优势距离 / 起手姿态 / 移动方式 / 攻击习惯 / 反制策略 / 武器弹药 / 力量节奏 / 结束方式）
- **空间方向**与**跨镜连续性**（角色数量、武器、投射物、朝向、场景损伤不自动重置）
- **镜头职责**（每个镜头只承担一个主要职责）
- 单变量**排错方法**（失败时只改动作 / 镜头 / 参考素材中的一类）

**支持模型**：Seedance、MiniMax-H3，以及通用文生视频模型。

**适用题材**：打斗、武打、追逐、对抗、演武、人兽战、风格化材质动作。

> 来源：https://github.com/irenerachel/fight-prompt-director 许可：MIT License 本技能只产出提示词，不调用任何外部生图/生视频 API。

---

## 二、安装（3 选 1）

### A. WorkBuddy（推荐）

把整个 `fight-prompt-director/` 文件夹复制到：

```
~/.workbuddy/skills/fight-prompt-director/
```

重启 WorkBuddy 后即可在 `Skill` 工具中看到 `fight-prompt-director`。

### B. Claude Desktop / Cursor / 其他支持 Agent Skills 的工具

复制到对应工具的 `skills/` 目录，例如：

```
~/.claude/skills/fight-prompt-director/
```

### C. 当作知识库直接读（无 Skills 协议时）

解压到任意位置，需要时让 AI `Read SKILL.md` 启动「动作导演」persona 即可。

---

## 三、怎么用

对话里直接说需求，例如：

> "帮我写一段 15 秒的双人剑斗提示词，Seedance，16:9" "这张首帧图生成一段人兽战，要能看清接触和位移" "生成失败，动作被缩没了，帮我排错"

**它会按 11 步推进**：确认参数 → 判断输入模式 → 建角色档案 → 明确场景目标 → 编排因果交锋 → 选结构 → 分配时长 → 设计三套强度 → 选摄影机 → 输出 → 失败修正。

### 默认参数（缺什么自动补，不重复追问）

参数默认时长15 秒模型Seedance画幅16:9输出语言中文速度标准版

### 两档速度 × 三套强度

- **速度**：标准版 / 极速版（极速版让三套方案整体变快，起手 0.15 秒内出现）
- **强度**：高强度 / 慢节奏 / 中间型（默认输出三套完整方案）

### 输入模式

文生视频 / 首帧图生视频 / 首尾帧 / 分镜驱动 / 动作参考视频 / 运镜参考视频

---

## 四、目录结构

```
fight-prompt-director/
├── SKILL.md                        # 主文件（动作导演 persona，11 步工作流）
├── README.md                       # 项目说明（中英双语）
├── LICENSE                         # MIT
├── references/
│   ├── fight-design.md             # 动作结构 + 7 类原创示例（单人突围/双人攻防/远程能量/一人对多人/人兽对决/单人演武/风格化材质）
│   ├── camera-guide.md             # 摄影机指南（镜头句式/职责/阶段选择/三档强度搭配/连续性/声音/常见误用）
│   └── diagnostics.md              # 失败诊断与验收（三类变量/症状修正/验收清单/修正记录模板）
└── INSTALL.md                      # 本文件
```

---

## 五、与 `ai-manga-generator` 的配合

如果你同时装了 `ai-manga-generator`（AI 漫剧生成技能），两者是**互补**关系：

场景用哪个整体漫剧策划：转脚本 → 角色/场景资产 → 分镜故事板 → 全流程`ai-manga-generator`单个动作/打斗镜头的**提示词精修**（要可见因果、跨镜连续、三套强度方案）`fight-prompt-director`

实操建议：先用 `ai-manga-generator` 出分镜脚本表，拿到「打斗镜头」那几行后，再调 `fight-prompt-director` 把这几镜写成可直接喂给 Seedance / MiniMax-H3 的完整提示词。

---

## 六、外部工具依赖（自行准备）

- 视频生成：即梦 Seedance 2.5、MiniMax-H3、其他通用文生视频模型
- 生图（做首帧/尾帧）：GPT-image-2、即梦 image2
- 剪辑：剪映

---

## 七、版本信息

- 来源：GitHub `irenerachel/fight-prompt-director`
- 许可：MIT（可自由使用、修改、分发，需保留版权声明）
- 文件数：6（SKILL.md + README.md + LICENSE + 3 个 references + INSTALL.md）