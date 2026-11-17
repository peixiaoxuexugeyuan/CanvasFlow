# 诺兰声音设计体系

## 目录

- [核心声音哲学](#核心声音哲学)
- [五层声音架构](#五层声音架构)
- [混音权重标准](#混音权重标准)
- [标志性声音动机](#标志性声音动机)
- [分影片声音变体](#分影片声音变体)
- [分主题声音配置](#分主题声音配置)
- [声音提示词模板](#声音提示词模板)

---

## 核心声音哲学

### 声画一体
- 声音不是画面附属，而是叙事的平等伙伴
- 音乐、音效、画面在数学结构上统一(敦刻尔克: 谢泼德音调与三线交叉剪辑同构)
- 声音设计在剧本阶段即开始构思

### 压迫性沉浸
- 目标: 让观众"身处其中"而非"旁观其外"
- 手段: 持续低频底噪 + 不断升级的紧张感 + 突然静默
- 效果: 生理层面的不安(心跳加速、肌肉紧绷)

### 极简主义
- 拒绝旋律性强的配乐，偏好单一音色/动机的持续变奏
- 战略性静默比持续音墙更有力量
- 人声略低于配乐，不强行置顶

---

## 五层声音架构

### 第一层: 节奏锚点层 (Rhythm Anchor)
提供时间感和推进力的节拍元素，是诺兰声音的骨架。

| 节奏类型 | 描述 | 提示词 |
|----------|------|--------|
| 时钟滴答 | 机械钟表规律性滴答 | `ticking clock, 60-72 BPM, metronomic precision` |
| 秒表走时 | 更急促的计时声 | `stopwatch tick, urgent precision timing` |
| 低频心跳 | 角色主观视角 | `heartbeat thud, accelerating tempo` |
| 管风琴持续音 | 庄严长音脉冲 | `pipe organ sustained drone, cathedral pulse` |
| 机械脉冲 | 不规则机械节拍 | `irregular mechanical pulse, gear clicking` |

### 第二层: 环境底噪层 (Ambient Base)
持续存在的低频环境声，建立空间感。

| 场景 | 底噪 | 提示词 |
|------|------|--------|
| 都市 | 城市低频嗡鸣 | `low-frequency urban hum, traffic drone, HVAC vibration` |
| 室内 | 房间音调 | `room tone, fluorescent buzz, distant mechanical hum` |
| 战场 | 海浪/风/远处炮火 | `ocean waves, wind howling, distant artillery rumble` |
| 太空(舱内) | 生命维持系统 | `spacecraft life support hum, air circulation` |
| 太空(舱外) | 完全静默 | `absolute vacuum silence, zero ambient` |
| 空旷空间 | 厚重混响 | `vast space reverb, decay time >= 2 seconds` |

### 第三层: 配乐特征层 (Score Character)
诺兰式配乐的核心特征，非旋律驱动。

| 特征 | 描述 | 提示词 |
|------|------|--------|
| 谢泼德音调 | 无限上升的紧张感 | `Shepard tone, infinitely ascending pitch illusion` |
| 大提琴持续音 | 低沉绵长的弦乐 | `low cello sustained drone, mournful continuous` |
| 厚重铜管和声 | 铜管乐堆叠的音墙 | `thick brass chord wall, overwhelming harmonic weight` |
| 无旋律原则 | 全程无朗朗上口的旋律 | `no catchy melody, continuous slow crescendo` |
| 管风琴 | 教堂般庄严 | `pipe organ swelling, cathedral reverb` |

### 第四层: 人声处理层 (Vocal Treatment)
诺兰混音中人声的特殊处理。

| 处理方式 | 描述 | 提示词 |
|----------|------|--------|
| 音量关系 | 人声略低于配乐但清晰可辨 | `dialogue slightly below score level, clearly intelligible` |
| 空间混响 | 带空间感的混响 | `spatial reverb on dialogue, environmental acoustics` |
| 咬字特征 | 清晰但不刺耳 | `clear articulation without harshness` |
| 生理细节 | 微弱呼吸声/吞咽声可闻 | `subtle breathing audible, swallowing sounds present` |
| 头盔内(太空) | 封闭空间感 | `helmet-enclosed voice, radio filter, breathing echo` |

**避坑警告**: 诺兰混音是"人声略低于配乐但清晰可辨"，不是"人声被配乐淹没听不清"。禁止写"dialogue buried in mix"或"voice overwhelmed by music"。人声占比建议不低于20%(日常/传记场景应达45%)。详见 [pitfall-guide.md 坑16](pitfall-guide.md)。

### 第五层: 转折音效层 (Transition SFX)
用于剧情拐点的冲击力音效。

| 音效 | 描述 | 提示词 |
|------|------|--------|
| 低频轰鸣 | 突发的超低频冲击 | `sudden sub-bass boom, chest-rattling impact` |
| 金属碰撞 | 带长回声的金属声 | `metal collision with long reverb tail` |
| 玻璃碎裂慢放 | 减速的玻璃破碎 | `glass shattering in slow motion, extended fracture` |
| BRAAAM | 铜管重击标志音 | `massive brass BRAAAM hit, seismic bass impact` |
| 俯冲啸叫 | 斯图卡式尖叫 | `dive-bomber siren, Jericho trumpet wail` |

---

## 混音权重标准

遵循诺兰电影的混音特点，不同主题有微调:

| 主题 | 配乐 | 环境音 | 人声 | 音效 | 说明 |
|------|------|--------|------|------|------|
| 通用标准 | 40% | 30% | 20% | 10% | 人声清晰可辨，不强行置顶但绝不淹没 |
| 都市犯罪 | 45% | 25% | 20% | 10% | 配乐压迫感更强 |
| 时空科幻 | 50% | 20% | 0-15% | 15-30% | 音效占比提升 |
| 宏大史诗 | 50% | 25% | 15% | 10% | 管风琴主导 |
| 心理悬疑 | 35% | 30% | 25% | 10% | 人声更突出(呼吸) |
| 历史传记 | 20% | 30% | 45% | 5% | 人声主导叙事 |
| 日常写实 | 15% | 35% | 45% | 5% | 最自然的混音 |

---

## 标志性声音动机

### 谢泼德音调 (Shepard Tone)
- 原理: 多八度叠加音阶，制造"永远在上升"的听觉错觉
- 使用: 《敦刻尔克》全片、《黑暗骑士》蝙蝠摩托、《致命魔术》
- 提示词: `Shepard tone, infinitely rising pitch, auditory illusion of perpetual ascent`

### BRAAAM
- 原理: 极低频铜管重击，经大幅减速/降调处理
- 起源: 《盗梦空间》预告片
- 提示词: `BRAAAM, massive slowed-down brass hit, seismic bass impact`

### 时钟滴答
- 原理: 机械钟表规律性滴答嵌入配乐底层
- 使用: 《敦刻尔克》(诺兰亲手录制怀表)、《星际穿越》(1.25秒/天)
- 提示词: `ticking clock motif, mechanical watch tick, countdown pulse`

### 管风琴脉冲
- 原理: 教堂管风琴持续音+脉冲式演奏
- 使用: 《星际穿越》核心音色
- 提示词: `pipe organ pulse, cathedral resonance, cosmic hymn`

---

## 分影片声音变体

### 黑暗骑士风格
```
Base: rain ambience, distant siren echo, city low drone
Score: low brass theme, single-interval锯齿波 (Joker motif)
Tension: 9-minute sustained tone pressure causing physiological unease
Key: deep cello + brass, no melody, pure pressure
```

### 盗梦空间风格
```
Base: muffled environment (dream layer dependent)
Score: "BRAAAM" brass hits, organ time-collapse
Tension: time-dilated music - each dream layer at different tempo
Key: "Time" - 11:35 mathematical fractal structure
```

### 星际穿越风格
```
Base: spacecraft hum / vacuum silence
Score: pipe organ (church timbre), clock tick at 1.25s/day
Tension: organ crescendo to unbearable volume
Key: "Cornfield Chase" - organ simulating fifth-dimensional vibration
```

### 敦刻尔克风格
```
Base: ocean waves + wind (overwhelming, continuous)
Score: Shepard tone + pocket watch tick + Elgar "Nimrod" fragments
Tension: perpetual ascent, never resolves, tick stops = relief
Key: script written to Shepard tone mathematical principle
```

### 信条风格
```
Base: electromagnetic hum, industrial drone
Score: reversed audio, backward-sampled instruments
Tension: forward and reverse sounds coexisting, temporal撕裂
Key: Ludwig Goransson, industrial electronic + reversed samples
```

### 奥本海默风格
```
Base: quiet room tone, paper shuffle, pen writing
Score: violin pulse accelerating (chain reaction metaphor)
Tension: gradual build from silence to overwhelming
Key: nuclear detonation - flash (silence) then delayed blast wave
```

---

## 分主题声音配置

| 主题 | 节奏锚点 | 环境底噪 | 配乐特征 | 混音权重 |
|------|----------|----------|----------|----------|
| 都市犯罪 | 不规则低频脉冲 70-80BPM | 雨夜+城市嗡鸣 | 低沉大提琴持续音 | 配乐45/环境25/人声20/音效10 |
| 时空科幻 | 时钟滴答/倒放机械 60-120BPM | 电磁嗡鸣+空间共振 | 谢泼德音调+BRAAAM | 配乐50/环境20/人声0-15/音效15-30 |
| 宏大史诗 | 缓慢时钟 48BPM | 太空静默/飞船系统 | 管风琴脉冲+弦乐 | 配乐50/环境25/人声15/音效10 |
| 心理悬疑 | 心跳/不规则节拍 | 空旷混响+机械底噪 | 谢泼德音调+钢琴单音 | 配乐35/环境30/人声25/音效10 |
| 历史传记 | 小提琴脉冲渐加速 | 安静室内环境 | 从极简到极繁渐变 | 配乐20/环境30/人声45/音效5 |
| 日常写实 | 微弱或无 | 自然环境音 | 极简或无配乐 | 配乐15/环境35/人声45/音效5 |

---

## 声音提示词模板

### 标准格式
```
[SOUND DESIGN]
Rhythm Anchor: {节奏类型} at {BPM} BPM
Ambient Base: {环境底噪描述}
Score Character: {配乐特征描述}
Vocal Treatment: {人声处理方式}
Transition SFX: {转折音效描述}
Silence Strategy: {静默策略}
Mix Weight: score {X}% / ambient {Y}% / dialogue {Z}% / SFX {W}%
```

### 快速声音标签
```
sound design: Shepard tone rising, ticking clock, sub-bass rumble,
strategic silence, Christopher Nolan auditory aesthetic,
BRAAAM brass hit, immersive tension, mechanical pulse,
dialogue recessed below score, spatial reverb
```

### 负面声音提示词
```
avoid: cheerful melody, pop songs, catchy themes,
cartoon sound effects, video game UI sounds,
overdramatic orchestral stings, horror jump scare sounds,
musical theater belting, upbeat tempo
```
