# 说一个成语，Agent 就能剪出一条竖屏故事片

你有没有过这种瞬间——

想给孩子讲《曹冲称象》，手机一划，全是同质化 PPT 式短视频：大字报标题、配乐吵得慌、画面还对不上旁白。

或者你自己做内容：寓言故事明明人人爱看，可从分镜、配音、字幕到成片，一折腾就是一下午。

现在有个更省事的玩法：

**你只说故事名。AI Agent 按一套固定流程，给你吐出一条可发的 9:16 剪纸成片。**

这个流程，我们做成了开源 Skill：`paper-collage-fable`。

仓库在这里：  
https://github.com/devin2255/paper-collage-fable

---

## 先看成品：《司马光砸缸》

不是概念图，是已经剪出来的成片截帧。竖屏剪纸、白话旁白、字幕烧在画面上——发出去就能看。

**开场：院中巨缸，玩耍起势**

![司马光砸缸成片截帧1](https://raw.githubusercontent.com/devin2255/paper-collage-fable/main/docs/assets/sima-guang/shot-01.jpg)

**冲突：小孩落水，同伴逃跑，司马光站住**

![司马光砸缸成片截帧3](https://raw.githubusercontent.com/devin2255/paper-collage-fable/main/docs/assets/sima-guang/shot-03.jpg)

**行动：从外侧抡石砸缸壁**

![司马光砸缸成片截帧4](https://raw.githubusercontent.com/devin2255/paper-collage-fable/main/docs/assets/sima-guang/shot-04.jpg)

**点题：水流泻出，得救，纸签落款**

![司马光砸缸成片截帧5](https://raw.githubusercontent.com/devin2255/paper-collage-fable/main/docs/assets/sima-guang/shot-05.jpg)

对 Agent 说一声「司马光砸缸」，就会自动走完这条流水线。我们还实做过《掩耳盗铃》《曹冲称象》——流程跑通了，才敢拿出来讲。

---

## 它到底解决什么问题？

不是「再生成一段文案」，而是直接交付**能播的视频**。

默认成片长这样：

- 竖屏 9:16，适合短视频和朋友圈
- 半色调剪纸拼贴风，一眼有辨识度
- 白话文旁白，不念之乎者也
- 本地推镜动画，不烧云端额度
- 字幕直接烧进画面，发出去就能看

你对 Agent 说一句：

「曹冲称象」

它就会自己走完：白话分镜 → 剪纸关键帧 → 推镜成片 → 配音 → 拼轨 → 烧字幕 → `final.mp4`。

---

## 为什么是「Skill」，不是又一个网页工具？

网页工具通常是：你点按钮，它给你结果，逻辑黑盒，换个故事又要重新摸索。

Skill 是给 Cursor、Claude Code、Codex、OpenCode 这类 Agent 用的「可复用工作说明书」。

装一次之后，Agent 知道：

1. 故事名怎么落成 5 场白话分镜  
2. 剪纸视觉怎么锁风格，避免每镜换一张脸  
3. 推镜怎么渲，旁白怎么卡时长  
4. 字幕怎么烧，成片交到哪个路径  

你换故事，不用换流程。  
你换 Agent 框架，安装路径变一变就行。

这才是它真正省时间的地方：**把一次偶然做对的事，沉淀成下次还能复用的能力。**

---

## 默认免费，是刻意设计的

做短视频最容易被劝退的，是「每条都要扣一次生成费」。

所以这个 Skill 默认走本地路线：

- 动画：ffmpeg 推镜（Ken Burns）
- 配音：edge-tts
- 拼片 / 字幕：本机脚本

想要更「纸片真在动」的效果，也可以再升级 Seedance；但那是可选项，不是入场券。

对家长、老师、个人创作者来说，这意味着：

**灵感来了就能做，不用先充值再创作。**

---

## 怎么装？（四条命令够用）

先装系统依赖：`ffmpeg`、`ffprobe`、`node`、`python`，再：

```bash
pip install edge-tts
```

然后按你用的 Agent，把仓库 clone 到对应目录：

**Cursor（全局）**

```bash
git clone https://github.com/devin2255/paper-collage-fable.git ~/.cursor/skills/paper-collage-fable
```

**Claude Code**

```bash
git clone https://github.com/devin2255/paper-collage-fable.git ~/.claude/skills/paper-collage-fable
```

**Codex**

```bash
git clone https://github.com/devin2255/paper-collage-fable.git ~/.codex/skills/paper-collage-fable
```

**OpenCode**

```bash
git clone https://github.com/devin2255/paper-collage-fable.git ~/.config/opencode/skills/paper-collage-fable
```

懒得记那么多？装到兼容面最广的路径也行：

```bash
git clone https://github.com/devin2255/paper-collage-fable.git ~/.agents/skills/paper-collage-fable
```

Windows 把 `~` 换成你的用户目录即可。更细的安装说明、符号链接、项目级安装，README 里都写全了。

---

## 装完怎么用？

新开一个 Agent 对话，直接说：

```text
孔融让梨
```

或者：

```text
用 paper-collage-fable 做「愚公移山」竖屏剪纸视频
```

几分钟到十几分钟后（看机器和出图速度），你会在项目目录拿到：

`renders/final.mp4`

里面已经有旁白和字幕。拿去发短视频、发朋友圈、给孩子看，都够用。

分镜不满意？跟 Agent 说「分镜 3 重画」。  
缺字幕？说「补字幕」。  
想更生动？再说「这两镜改成动态」。

人负责审美和取舍，流水线负责重复劳动。

---

## 它适合谁？

- 想给孩子做「成语故事短视频」的家长  
- 需要稳定竖屏素材的教育 / 国学账号  
- 用 Cursor、Claude Code、Codex、OpenCode 的开发者与创作者  
- 嫌每次从零写提示词、从零拼成片的人  

一句话：

**你负责点题，Agent 负责出片。**

---

## 最后送你一个用法

今晚就试这一句：

「做一个守株待兔」

如果成片出来了，欢迎在评论区甩你的故事名；  
如果卡在安装或依赖上，也直接说你的框架（Cursor / Claude Code / Codex / OpenCode），我按路径帮你对一下。

开源地址再放一次，方便收藏：

https://github.com/devin2255/paper-collage-fable

点个在看，让更多做内容的人少走弯路。你下一个想做成片的成语，是哪一个？
