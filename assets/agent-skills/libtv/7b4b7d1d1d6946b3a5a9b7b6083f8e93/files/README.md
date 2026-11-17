# Seedance Product Video Director Skill

这是一个面向 LibTV / OpenClaw Agent 的 Seedance 2.0 产品口播视频工作流 Skill。

## 作用

它不替代官方 `libtv-skill`，而是负责：

- 文案分析与自动拆段；
- 资产收集和批准；
- 产品比例与包装控制；
- 表演、运镜和场景真实性设计；
- 一次只生成一段；
- 生成前预检；
- 生成后质检；
- 尾帧续接、硬切和新首帧决策；
- 避免无效重生成与积分浪费。

## 依赖

先安装官方 LibTV Skill，并设置环境变量：

```bash
npx skills add libtv-labs/libtv-skills --skill libtv-skill
export LIBTV_ACCESS_KEY="your-access-key"
```

然后将整个 `seedance-product-video-director` 文件夹复制到你的 Agent Skills 目录。

## 推荐用法

对 Agent 说：

> 使用 Seedance 产品口播视频导演 Skill。先让我提供文案，按流程逐段制作，不要批量生成。

## 文件

- `SKILL.md`：主工作流；
- `references/prompt-template.md`：单段提示词模板；
- `references/qc-checklist.md`：生成后质检标准；
- `references/project-state-template.md`：项目状态记录模板。

## v3 重点改进

- 角色可以坐着或停着，不再机械要求持续移动；
- 第一画面必须具备行为、关系、环境三类锚点中的至少两类；
- 先判断观众以“推荐、分享、偷听还是解释”的方式接受信息；
- 支持双人对聊和三人同桌的松弛口播；
- 摄影机可以是桌边旁听者，主角不必持续看镜头；
- 优先使用签子、杯子、毛巾等场景原生道具激活人物；
- 经验分享和偷听对话默认延迟产品露出；
- 场景首先服务于信任与话题自然度，其次才是美感。
