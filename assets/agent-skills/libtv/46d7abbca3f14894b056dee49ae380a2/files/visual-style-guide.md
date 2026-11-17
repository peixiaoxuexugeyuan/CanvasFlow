# 古龙武侠片场 — 视觉风格与 Prompt 指南

> 本文件为 LibTV Agent 画面生成提供完整的 prompt 构建参考。 视觉方向：**经典复古邵氏武侠电影风格（Shaw Brothers Vintage Wuxia）**。

---

## 1. 邵氏复古美学基底 Prompt

所有画面共享以下风格基底，拼接在每条 prompt 末尾：

```
Shaw Brothers kung fu movie aesthetic, vintage 1970s Hong Kong martial arts film,
warm amber color grading, subtle film grain texture, dramatic low-key lighting,
cinematic composition, retro Chinese wuxia, practical effects,
handcrafted props and costumes, golden hour atmosphere,
analog film look, rich detail, professional cinematography,
shallow depth of field, natural shadows
```

> **用法：** `[场景/角色/动作描述] + [情绪修饰词] + [基底 Prompt]`

---

## 2. 情绪基调修饰词表

### 2.1 悲壮苍凉

**修饰词：** tragic hero, desolate landscape, autumn leaves scattering, cold wind blowing robes, fading sunset on horizon, melancholy atmosphere, weathered stone monument, dried blood on sword

**示例 Prompt：**

```
A lone swordsman kneeling on a barren hilltop, autumn leaves swirling around him,
fading sunset casting long shadows, torn robe fluttering in cold wind,
a broken sword planted in the earth before him, melancholy atmosphere,
desolate landscape stretching to the horizon, tragic hero,
Shaw Brothers kung fu movie aesthetic, vintage 1970s Hong Kong martial arts film,
warm amber color grading, subtle film grain texture, dramatic low-key lighting,
cinematic composition, analog film look, shallow depth of field
```

### 2.2 快意恩仇

**修饰词：** fierce combat, dynamic action pose, blazing fire backdrop, righteous fury, intense confrontation, powerful stance, sparks from clashing blades, wind-swept hair

**示例 Prompt：**

```
Two martial artists locked in fierce combat inside a burning temple hall,
dynamic action pose mid-strike, blazing fire casting orange light on faces,
sparks flying from clashing swords, righteous fury in their eyes,
intense confrontation, powerful stance, wooden beams collapsing,
Shaw Brothers kung fu movie aesthetic, vintage 1970s Hong Kong martial arts film,
warm amber color grading, dramatic low-key lighting, cinematic composition,
practical effects, analog film look, professional cinematography
```

### 2.3 孤独寂寥

**修饰词：** solitary figure, empty cobblestone street, moonlight shadow, silent night, lonely tavern interior, distant gaze, half-empty wine cup, cold mist

**示例 Prompt：**

```
A solitary figure in dark robes sitting alone in an empty tavern at night,
moonlight shadow falling through a lattice window, a half-empty wine cup on the table,
distant gaze toward the door, silent night outside, cold mist drifting in,
cobblestone street visible through the open doorway,
Shaw Brothers kung fu movie aesthetic, vintage 1970s Hong Kong martial arts film,
warm amber color grading, subtle film grain, dramatic low-key lighting,
cinematic composition, analog film look, shallow depth of field, natural shadows
```

### 2.4 悬疑诡谲

**修饰词：** mysterious fog, dark narrow alley, hidden blade glinting, suspenseful shadows, candlelit room, unseen threat, silhouette behind screen, poisoned dart

**示例 Prompt：**

```
A shadowy figure standing at the end of a dark narrow alley,
mysterious fog rolling along the ground, a hidden blade glinting faintly,
suspenseful shadows stretching across wet stone walls,
a single candlelit window glowing in the distance, unseen threat lurking,
Shaw Brothers kung fu movie aesthetic, vintage 1970s Hong Kong martial arts film,
warm amber color grading, subtle film grain texture, dramatic low-key lighting,
cinematic composition, analog film look, natural shadows, rich detail
```

---

## 3. 场景类型 Prompt 模板

### 3.1 山崖 / 荒野

```
Dramatic cliff edge overlooking a vast canyon, jagged rock formations,
dried grass swaying in the wind, distant mountain peaks shrouded in haze,
a weathered stone path leading to the precipice, ancient pine tree on the edge,
golden hour light illuminating the rock face,
[BASE PROMPT]
```

### 3.2 竹林 / 树林

```
Dense bamboo forest with shafts of sunlight piercing through,
fallen leaves on mossy ground, mist drifting between tall stalks,
a narrow dirt path winding deeper into the grove,
dappled light creating patterns on the forest floor,
[BASE PROMPT]
```

### 3.3 古镇街道 / 酒馆

```
Ancient Chinese town main street at dusk, wooden shopfronts with hanging lanterns,
cobblestone path, a weathered tavern entrance with torn banner,
steam rising from a noodle stall, calligraphy signs on doors,
sparse pedestrians in traditional robes, warm interior glow from windows,
[BASE PROMPT]
```

### 3.4 宫殿 / 寺庙

```
Grand ancient Chinese temple interior, towering wooden pillars with red lacquer,
incense smoke curling upward, a bronze Buddha statue in soft candlelight,
carved stone floor tiles, silk banners hanging from high beams,
shaft of light from an opening in the roof, ornate wooden ceiling details,
[BASE PROMPT]
```

### 3.5 雨夜 / 雪中

```
Heavy rain falling on a moonlit village, puddles reflecting lantern light,
wet rooftops glistening, a cloaked figure walking through the downpour,
rain streaks visible in the air, distant thunder implied by dark clouds,
water dripping from eaves, traditional tiled roofs,
[BASE PROMPT]
```

### 3.6 密室 / 暗道

```
Underground stone chamber lit by flickering torches, rough-hewn walls,
a hidden mechanism in the wall, cobwebs in corners, a wooden chest in the center,
narrow passage leading into darkness, dust particles in torchlight,
secret tunnel entrance behind a bookshelf, oppressive low ceiling,
[BASE PROMPT]
```

---

## 4. 角色外貌 Prompt 模板

> **一致性策略：** 每个角色固定一组"锚定关键词"（标 `★`），在所有分镜中保持不变，仅改变动作和环境描述。

### 4.1 冷面剑客（游侠型）

```
★ Tall lean Chinese man in his 30s, sharp angular face, cold piercing eyes,
thin lips pressed together, ★ long black hair loosely tied with a leather cord,
★ dark navy blue cotton robe with worn leather belt, ★ a long straight jian sword at his waist,
scuffed leather boots, a faded scar across his left cheek,
confident upright stance with hand resting on sword hilt,
[BASE PROMPT]
```

### 4.2 红衣女侠（巾帼型）

```
★ Chinese woman in her mid-20s, fierce determined expression, bright almond eyes,
★ hair styled in a high ponytail with a red silk ribbon,
★ crimson red fitted martial arts tunic with silver frog-button closures,
★ twin daggers sheathed at her thighs, dark trousers and cloth ankle wraps,
graceful combat stance, one dagger drawn and held low,
[BASE PROMPT]
```

### 4.3 灰袍老者（宗师型）

```
★ Elderly Chinese man in his 60s, weathered wise face, deep-set calm eyes,
long grey beard reaching his chest, ★ loose grey cotton robe with wide sleeves,
★ gnarled wooden staff with carved dragon head, straw sandals,
a small jade pendant hanging from his sash, serene upright posture,
hands clasped behind his back, ★ grey robe and wooden staff always present,
[BASE PROMPT]
```

### 4.4 黑衣杀手（反派型）

```
★ Muscular Chinese man in his 40s, shaved head, cold menacing eyes,
a thin scar across his throat, ★ all-black fitted combat outfit with high collar,
★ a curved dao blade strapped across his back, forearm leather bracers,
heavy black boots, iron wrist rings, ★ black outfit and curved dao blade always present,
intimidating wide stance, arms crossed,
[BASE PROMPT]
```

---

## 5. 画面禁忌清单

### 绝对禁止

类别禁止内容现代元素现代建筑、高楼、玻璃幕墙、电子设备（手机/电脑/电视）、汽车、电线杆现代服饰T恤、牛仔裤、运动鞋、墨镜、手表、现代眼镜环境破坏霓虹灯、LED 招牌、塑料材质、柏油马路、现代路灯内容红线过度血腥（断肢/内脏外露）、色情裸露、性暗示文化混淆日式和服、武士刀、忍者装束、韩式韩服、日本盔甲

### 需要避免

- 过于鲜艳饱和的荧光色
- 均匀无对比的平光照明
- 卡通/动漫/Q版风格
- 现代 CG 特效感（应保持实拍质感）
- 明显的 AI 生成痕迹（多余手指、扭曲文字）

---

## 6. 色彩与光线参考

### 主色调

色彩用途Prompt 关键词琥珀色整体基调、外景日光`warm amber color grading`暗金色室内烛光、高光区域`golden warm highlights`深红色服饰点缀、血迹、灯笼`deep crimson accents`墨色阴影、暗部、夜景`ink-black shadows`青灰色阴天、雪地、悲凉场景`muted blue-grey tones`

### 光线方案

场景类型光线方案Prompt 关键词外景日间低角度侧光 + 金色调`golden hour side lighting, warm directional light`室内烛光暖光 + 高对比`candlelight illumination, strong chiaroscuro`夜景月光冷光 + 局部暖光`cool moonlight with warm lantern accents`打斗逆光剪影 + 动态阴影`backlit silhouette, dynamic moving shadows`悬疑低光 + 大面积阴影`extreme low-key lighting, deep shadows`

### 色彩/光线禁止

- **禁止：** 高饱和荧光色（荧光绿、电光蓝、亮粉）
- **禁止：** 均匀平光（flat lighting, even studio lighting）
- **禁止：** 现代 LED 白光效果
- **禁止：** HDR 过度、赛博朋克色调