# paper-collage-fable

把**中国寓言 / 成语故事名**做成可播放的 **9:16 竖屏剪纸成片**（白话文旁白 + 推镜动画 + 烧录字幕）。

默认全本地、零云端费用。你只需要对 Agent 说故事名，例如：

```text
曹冲称象
做一个孔融让梨
剪纸故事：守株待兔
```

Agent 会自动：白话 5 场剧本 → 剪纸关键帧 → Ken Burns 推镜 → TTS 旁白 → 拼片 → 烧字幕 → 交出 `renders/final.mp4`。

---

## 效果约定

项默认画幅9:16 · 1080×1920旁白白话文（非文言）动画本地推镜（ffmpeg zoompan）配音edge-tts `zh-CN-XiaoxiaoNeural`字幕ASS 烧录（微软雅黑，白字黑边）Seedance 图生视频默认关闭；用户明确要求且有额度时才用

成片路径：`<project>/renders/final.mp4`

---

## 仓库结构

```text
paper-collage-fable/
├── SKILL.md                 # Agent 主指令（必须）
├── reference.md             # 旁白/分镜/Windows 细则
├── examples.md              # 触发样例与已验证路径
├── README.md                # 本文件
├── .gitignore
└── scripts/
    ├── kenburns_scenes.py   # 关键帧 → 推镜 MP4
    ├── write_manifest.py    # 生成 production-manifest.json
    └── burn_subs.py         # 生成 ASS 并烧录字幕
```

依赖的拼片脚本（不在本仓库内，需本机已有）：

```text
~/.agents/skills/paper-collage-ad/scripts/assemble.mjs
```

若尚未安装 `paper-collage-ad`，可先装该 skill，或让 Agent 用同等 ffmpeg 拼接逻辑替代。

---

## 系统依赖

所有框架通用：

```bash
# 需要在 PATH 中
ffmpeg
ffprobe
node   # >= 18，用于 assemble.mjs
python # 3.8+

# 旁白
pip install edge-tts
```

可选（仅 Seedance 动态升级）：

```bash
# inference.sh CLI
belt
```

Windows 建议安装 [FFmpeg full build](https://www.gyan.dev/ffmpeg/builds/) 与 Node.js，并确保 `Microsoft YaHei` 字体可用（字幕用）。

---

## 安装到各 Agent 框架

> Skill 就是带 `SKILL.md` 的文件夹。安装 = 放到对应 Agent 会扫描的目录。\
> 下面以**本仓库**为准：`https://github.com/devin2255/paper-collage-fable.git`

把 `<SKILL_NAME>` 记为 `paper-collage-fable`。

### 1. Cursor

**用户级（全局，推荐）**

```bash
git clone https://github.com/devin2255/paper-collage-fable.git ~/.cursor/skills/paper-collage-fable
```

Windows PowerShell：

```powershell
git clone https://github.com/devin2255/paper-collage-fable.git "$env:USERPROFILE\.cursor\skills\paper-collage-fable"
```

**项目级**

```bash
mkdir -p .cursor/skills
git clone https://github.com/devin2255/paper-collage-fable.git .cursor/skills/paper-collage-fable
```

Cursor 还会兼容扫描：`~/.agents/skills/`、`~/.claude/skills/`、`~/.codex/skills/`。

也可在 Cursor → **Customize / Rules** → Remote Rule (GitHub) 填本仓库 URL（若你的 Cursor 版本支持远程 skill/规则导入）。

重启或新开 Agent 对话后，直接说故事名即可触发。

---

### 2. Claude Code

**用户级**

```bash
git clone https://github.com/devin2255/paper-collage-fable.git ~/.claude/skills/paper-collage-fable
```

Windows：

```powershell
git clone https://github.com/devin2255/paper-collage-fable.git "$env:USERPROFILE\.claude\skills\paper-collage-fable"
```

**项目级**

```bash
mkdir -p .claude/skills
git clone https://github.com/devin2255/paper-collage-fable.git .claude/skills/paper-collage-fable
```

也可放在兼容路径：

```bash
git clone https://github.com/devin2255/paper-collage-fable.git ~/.agents/skills/paper-collage-fable
```

---

### 3. OpenAI Codex（CLI / Desktop）

**用户级**

```bash
git clone https://github.com/devin2255/paper-collage-fable.git ~/.codex/skills/paper-collage-fable
```

**项目级（仓库内）**

```bash
mkdir -p .agents/skills
git clone https://github.com/devin2255/paper-collage-fable.git .agents/skills/paper-collage-fable
```

Codex 会从当前目录向上扫描 `.agents/skills`，以及用户级 `~/.codex/skills`。\
也可用 Codex 的 `$skill-installer` 从 GitHub 安装（在对话里让 Codex 安装本仓库）。

---

### 4. OpenCode

**用户级**

```bash
git clone https://github.com/devin2255/paper-collage-fable.git ~/.config/opencode/skills/paper-collage-fable
```

**项目级**

```bash
mkdir -p .opencode/skills
git clone https://github.com/devin2255/paper-collage-fable.git .opencode/skills/paper-collage-fable
```

OpenCode 同时兼容：

- `~/.claude/skills/`
- `~/.agents/skills/`
- 项目内 `.claude/skills/`、`.agents/skills/`

---

### 5. 通用 / 多框架一次装好（推荐）

若你同时用 Cursor + Claude Code + Codex + OpenCode，可装到兼容最广的路径：

```bash
git clone https://github.com/devin2255/paper-collage-fable.git ~/.agents/skills/paper-collage-fable
```

Windows：

```powershell
git clone https://github.com/devin2255/paper-collage-fable.git "$env:USERPROFILE\.agents\skills\paper-collage-fable"
```

然后按需做符号链接（可选）：

```bash
# macOS / Linux 示例
ln -s ~/.agents/skills/paper-collage-fable ~/.cursor/skills/paper-collage-fable
ln -s ~/.agents/skills/paper-collage-fable ~/.claude/skills/paper-collage-fable
ln -s ~/.agents/skills/paper-collage-fable ~/.codex/skills/paper-collage-fable
ln -s ~/.agents/skills/paper-collage-fable ~/.config/opencode/skills/paper-collage-fable
```

PowerShell（管理员或开发者模式）：

```powershell
$src = "$env:USERPROFILE\.agents\skills\paper-collage-fable"
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.cursor\skills\paper-collage-fable" -Target $src -Force
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\skills\paper-collage-fable" -Target $src -Force
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.codex\skills\paper-collage-fable" -Target $src -Force
```

---

### 6. 用 npx skills（若已配置 skills CLI）

部分环境支持：

```bash
npx skills add devin2255/paper-collage-fable -g -y
```

具体是否可用取决于你本机 `skills` CLI 的源配置；不可用时退回上面的 `git clone`。

---

## 安装后如何触发

任意已安装框架的 Agent 对话中：

```text
纸船借箭
```

或更明确：

```text
用 paper-collage-fable 做「愚公移山」竖屏剪纸视频
```

Agent 应读取本 skill 的 `SKILL.md` 并按流水线交付 `final.mp4`。

---

## 本机脚本用法（可选，Agent 也会调用）

在故事项目目录下：

```bash
# 1) 关键帧 + 旁白 WAV 就绪后：推镜
python /path/to/paper-collage-fable/scripts/kenburns_scenes.py --project .

# 2) 写拼片清单
python /path/to/paper-collage-fable/scripts/write_manifest.py --project .

# 3) 拼片（依赖 paper-collage-ad）
node ~/.agents/skills/paper-collage-ad/scripts/assemble.mjs \
  --manifest manifests/production-manifest.json \
  --output renders/final-nosub.mp4

# 4) 烧字幕
python /path/to/paper-collage-fable/scripts/burn_subs.py --project .
```

---

## 故事项目目录示例

```text
cao-chong-cheng-xiang/
  brief.md
  script.md
  storyboard.json
  manifests/production-manifest.json
  assets/keyframes/scene-01.png … scene-05.png
  assets/voice-final/01.wav … 05.wav
  assets/audio/subtitles.ass
  renders/scene-01.mp4 … scene-05.mp4
  renders/final-nosub.mp4
  renders/final.mp4          ← 交付物
```

---

## 修订口令

你说Agent 应做分镜 3 不对只重画该关键帧 → 重推镜 → 重拼 + 字幕缺少字幕对现有工程跑 `burn_subs.py`换成动态纸片在有额度时用 Seedance 升级指定镜头

---

## 相关

- 剪纸广告母 skill（拼片 / 进阶动画）：`paper-collage-ad`（若你本机路径为 `~/.agents/skills/paper-collage-ad`）
- 细则：`reference.md` · 样例：`examples.md`

---

## License

MIT（若需更换许可证，请开 Issue / PR）