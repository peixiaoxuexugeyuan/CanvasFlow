# Suno 元标签完整指南与歌曲结构

## 一、元标签总览

元标签格式：`[标签内容]`，无大小写区分，仅起引导作用，不直接通过语言表达。可灵活混搭创新，无需局限于固定标签。

## 二、段落结构类标签

| 标签 | 中文 | 功能说明 |
|---|---|---|
| `[Intro]` | 前奏 | 开篇部分，建立基调，通常无歌词（特殊风格除外） |
| `[Verse]` / `[Verse 1]` / `[Verse 2]` | 主歌 | 主体部分，含主要故事/情感，旋律节奏固定，歌词不同 |
| `[Pre-Chorus]` | 前副歌 | 连接 Verse 与 Chorus，增强情感张力（可选） |
| `[Chorus]` / `[Final Chorus]` | 副歌 | 核心记忆点，重复出现，含歌曲主题，旋律最具辨识度 |
| `[Interlude]` | 间奏 | 无歌词乐器演奏，连接不同歌唱段落，实现情感转换（可选） |
| `[Bridge]` | 桥段 | 后半段过渡部分，旋律节奏与主歌/副歌不同，增加多样性 |
| `[Outro]` | 尾奏 | 结尾部分，呼应前奏或渐弱，完成歌曲收尾 |
| `[Break]` | 停顿 | 插入器乐停顿，打断当前流程，避免 AI 重复演唱 |

## 三、表演方式类标签

| 标签 | 中文 | 效果 |
|---|---|---|
| `[Laughter]` | 笑声 | 在段落中加入笑声 |
| `[Whispering]` | 耳语 | 耳语式演唱 |
| `[Spoken]` | 旁白 | 口语化念白，不唱 |
| `[Ad Libs]` | 即兴 | 即兴加花演唱 |

## 四、乐器/风格类标签

可灵活组合，示例：
- `[Piano Solo]` — 钢琴独奏段落
- `[Funky Beats]` — 放克节奏
- `[Electric Bass]` — 电贝斯主导
- `[Bass Drop]` — 贝斯落下（电子乐常用）
- `[Melodic Flute Interlude]` — 旋律长笛间奏
- `[Saxophone Solo]` — 萨克斯独奏
- `[Guitar Riff]` — 吉他重复段
- `[String Swell]` — 弦乐渐强
- `[Drum Fill]` — 鼓加花
- `[Synth Arpeggio]` — 合成器琶音

## 五、结尾控制标签

| 标签 | 效果 |
|---|---|
| `[Big Finish]` | 宏大收尾，全编制爆发结束 |
| `[End]` | 直接结束 |
| `[Fade Out]` | 渐弱结束 |
| `[Fade Out And End]` | 渐弱并结束 |
| `[Song Ends]` | 歌曲结束标记 |

**使用技巧**：
- 若 AI 未停止，可重复使用标签直至停止，如 `[Outro][Fade Out][Fade Out][Fade Out]`
- 片段时长少于1分钟时，AI 大概率会在此结束
- 可能出现突发鼓点继续创作的情况（属随机），可重新生成

## 六、歌曲结构标准模板

### 完整流行歌曲结构
```
[Intro]          ← 前奏，建立基调
[Verse 1]        ← 主歌1，故事开始
[Pre-Chorus]     ← 前副歌，张力积累
[Chorus]         ← 副歌，核心记忆点
[Interlude]      ← 间奏，气口/过渡
[Verse 2]        ← 主歌2，故事发展
[Pre-Chorus]     ← 前副歌
[Chorus]         ← 副歌重复
[Bridge]         ← 桥段，变化转折
[Final Chorus]   ← 最终副歌，情感爆发
[Outro]          ← 尾奏，收尾
```

### 简化结构（适合短歌）
```
[Intro]
[Verse 1]
[Chorus]
[Verse 2]
[Chorus]
[Outro]
```

### 民谣/叙事结构
```
[Intro]
[Verse 1]
[Verse 2]
[Chorus]
[Verse 3]
[Chorus]
[Outro]
```

### 电子舞曲结构
```
[Intro]
[Verse]
[Build Up]       ← 可用 [Pre-Chorus] 替代
[Drop]           ← 可用 [Chorus] 或 [Bass Drop]
[Break]
[Verse]
[Build Up]
[Drop]
[Outro]
```

## 七、Intro 与 Verse 拆分技巧

### 为什么要拆分
若直接写 `[Intro]—[Verse]`，AI 容易将两者合并处理，导致没有独立的前奏旋律，直接进唱。

### 推荐写法
```
(intro)—[verse]
```
或
```
(intro),(verse)
```

### 不推荐写法
```
[intro]—[verse]
```
（易导致 AI 合并，无独立前奏旋律）

### 特殊场景
说唱、摇滚乐若需要 intro 含歌词，可直接使用：
```
[intro] 歌词内容
[verse]
```
无需拆分。

## 八、前奏生成的两种方法

### 方法1：纯旋律前奏
用括号明确标注 intro 属性：
```
(intro, instrumental)
```

### 方法2：带乐器前奏
在 intro 中指定乐器和风格：
```
(intro, saxophone, jazz, instrumental)
```
```
(intro, piano, classical, instrumental)
```
```
(intro, acoustic guitar, folk, instrumental)
```

## 九、段落衔接实战

### 器乐停顿衔接
在 Verse 与 Chorus 间插入器乐停顿：
```
[verse]
...歌词...
[break]
[melodic interlude]
[chorus]
...歌词...
```

### 避免人声"遗忘"
使用 `[Break]` 后，需尽快衔接合唱/新段落。若人声沉默过久，AI 可能生成新音色，导致前后不一致。

### 器乐转人声过渡
生成器乐段落（间奏/前奏）后，让 AI 停止器乐演奏切换到人声：
在衔接的歌词前，添加括号包裹的语气词：
```
(Ohh, Ohh ohh)
[verse]
...歌词...
```
或
```
(Ah, yeah)
[chorus]
...歌词...
```
该方法对多数场景有效，若一次未成功可尝试调整语气词组合。

## 十、歌词延续规则

### 被切断的歌词如何继续
- 在下一个片段的歌词输入框中，直接衔接被切断的内容
- 若存在"单词被切半"的情况（如"快乐"被切成"快"），无需补充半字，直接从完整的下一个单词开始

### 被中断的元标签不要重复使用
若上一段的 `[Chorus]` 未唱完被切断，下一段衔接歌词时，**不要再次添加 `[Chorus]` 标签**。否则 AI 会判定为"新的副歌段落"，重新生成旋律，导致衔接断裂。

正确做法：直接续写歌词，不加标签。

### AI 重复演唱的处理
当 AI 重复演唱已唱过的内容（如重复主歌/副歌），在重复内容的末尾添加 `[Break]` 元标签，即可打断当前歌曲流程。后续可正常输入新段落的歌词与标签，恢复创作。

## 十一、旁白与即兴元素

### 旁白（Spoken）
使用 `[Spoken]` 标签标记念白段落：
```
[spoken]
这里是念白内容，不唱
[verse]
...歌词...
```

### 即兴加花（Ad Libs）
在歌词末尾用 `()` 包裹单词表示旁白/即兴，句尾使用效果最佳：
```
[verse]
Walking down the street, it starts to pour
People running for cover, but I want more
I throw my umbrella away, I hit the ground
Feeling the raindrops, dancing all around (oh-yeah)
```

### 非词汇性发声
在歌词中加入"啦啦啦""呐呐呐""沙呐呐"等无意义音节，尤其适合较短的提示语，可丰富音乐表现力：
```
[chorus]
啦……啦……啦……
我抬头看见了璀璨星光
```

## 十二、单段生成长度控制

- AI 单段最长生成约 **40秒**
- 首次生成建议只放 **2个段落**（如 intro—verse 或 verse—chorus）
- 内容过多会导致速度加快、质量下降
- 每段歌词行数控制在 **4-8行**
- 需要更长歌曲时使用「继续生成」功能逐段延长
