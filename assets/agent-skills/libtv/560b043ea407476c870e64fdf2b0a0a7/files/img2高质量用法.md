# img2 高质量用法（ChatGPT Images 2.0 / 2.5）

> 命名口径：**img2 ＝ ChatGPT Images 2.0**（OpenAI 官方图像模型），**img2.5 ＝ ChatGPT Images 2.5**（2026-09-08 发布，已取代 2.0 成默认）。本文件讲的是这两代 OpenAI 图像模型的真实用法，聚焦「怎么把它质量最高这件事榨出来，用在故事板图上」。
>
> 结论性质标注：**【官方】**＝OpenAI 官方文档/公告；**【多源】**＝多来源交叉一致的实测共识；**【单源】**＝单一来源，需自测验证。

---

## 0. 一页速查（先看这个）

| 问题                    | 结论                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------- |
| img2 定位是什么            | **质量最高的付费/配额图像模型**。用在最需要质感的画面（故事板图），不用在可走免费通道的资产图                                     |
| 写提示词的骨架               | **Scene → Subject → Important details → Use case → Constraints**（五槽位分段，官方结构）          |
| 2.5 相比 2.0 改进了什么      | 延迟降 50%、参考图身份保持更强、自然光/材质更真、**多轮编辑漂移更少**                                               |
| Flare vs Sunburst 怎么选 | **Flare 快速打样/探索方向；Sunburst 精修定稿/锁人物一致性**。故事板定稿选 Sunburst                              |
| 电影级画面的命门              | 锚定**导演/胶片/焦段/光向**具体参照，不写「电影感/大片/史诗」这类空词                                               |
| 多轮编辑公式                | `Change only X. Keep A/B/C/D unchanged. Match existing lighting. Add no new objects.` |
| 参考图怎么用                | **一图一职**：身份图只管脸，场景图只管环境，别让模型猜                                                         |
| 中文还是英文                | **混用**：主体/氛围/叙事用中文，镜头/光线/胶片/风格词用英文                                                    |

---

## 1. img2 是什么、为什么它是「质量最高」

### 1.1 定位（铁律）

- img2 不是免费无限出图的模型，它要花钱（ChatGPT 付费档 / API 按张计费；免费档只有较低配额）。**【官方】2.5 全档位开放，但免费档配额低、付费档才够量产。**
- 它值这个钱的地方：**同一句提示词，img2 出的画面质感、光影真实度、文字渲染、参考图还原度，普遍高于免费的国产模型。**
- 所以用法原则是：**把 img2 的钱花在「最需要质感」的画面上——故事板图（锁构图/景别/光向的视觉底本）**。资产图（三视图/场景/道具，量大且只求形准）走免费通道（即梦）。

### 1.2 2.5 相比 2.0 改进了什么

**【多源】（OpenAI 官方公告 + 多篇实测稿交叉一致）**

| 维度      | Images 2.0        | Images 2.5                               |
| ------- | ----------------- | ---------------------------------------- |
| 生成延迟    | 基线                | **最多降 50%**（官方口径，非逐张保证）                  |
| 参考图身份保持 | 支持                | **更强**——人脸/宠物/商品更像本人本物                   |
| 光线与材质   | 好                 | **更自然的光、更丰富的纹理、更锐的细节**                   |
| 多轮编辑一致性 | 会漂移               | **更稳**——改一处不再动不动重画整张                     |
| 交互      | 纯提示词              | 新增 **Sketch / Templates / 图片评论 / 提示词共享** |
| API 模型  | `gpt-image-2` 单路由 | **Flare + Sunburst 双路由**                 |

> 一句话：2.5 不追求「首稿更漂亮」这件事本身，而是&#x628A;**「改图不改毁别处」这条生产力回路做扎实了**——这正好是故事板反复打磨最需要的。

### 1.3 Flare vs Sunburst：两个子模型怎么选

**【官方】** 2.5 有两条 API 路由：`gpt-image-2.5-flare` 与 `gpt-image-2.5-sunburst`（ChatGPT 界面默认自动调度，API 可显式指定）。

| 维度     | **Flare（偏速度）**           | **Sunburst（偏质量）**         |
| ------ | ------------------------ | ------------------------- |
| 定位     | 快速、高质量日常生成               | 精细编辑、要求控制的创作/生产流程         |
| 官方推荐起点 | **多数场景的默认**              | 方向已定、偏差会造成真实成本时           |
| 适合场景   | 探索构图/风格/概念、批量打样、社媒/电商测试图 | 精修主视觉、海报、**人物一致性**、复杂定点编辑 |
| 故事板怎么用 | **前期快速出多版构图方向**          | **定稿锁人物/锁构图/锁光向时用**       |

> **实操规则**：还在「不知道这张图该长什么样」用 Flare；已经「要保护一个已通过的人物/构图/品牌，做精修」切 Sunburst。**人物一致性、三视图级还原，选 Sunburst。**

---

## 2. 提示词写法骨架（官方结构）

### 2.1 五槽位结构（OpenAI 官方推荐）

**【官方 + 多源】** img2 吃「分段式结构」，不吃「一长串逗号关键词」：

```
Scene:            在哪里、什么时间、什么环境
Subject:          谁 / 什么是画面焦点
Important details:材质、服装、纹理、光线、角度、焦段、构图、氛围
Use case:         这张图用来干什么（editorial photo / storyboard keyframe / poster…）
Constraints:      不要出现什么（no watermark / no extra text / preserve face…）
```

**为什么有效**：五个槽位分别回答五个常被糊在一起的问题——画面在哪、讲什么、哪些细节必须可见、要哪种成品、什么不能漂。**第五槽（Constraints）是平庸提示词最常见的静默翻车点**：只描述画面不划边界，模型会往你后悔的方向发挥。

**反例 → 正例**（官方公众号 + fal.ai 一致的示范）：

- ❌ `一个很漂亮的博物馆里的女人`
- ✅
  ```
  Scene: A quiet classical museum gallery in soft afternoon light.
  Subject: A woman in her 30s standing casually in front of a large oil painting.
  Important details: natural smile, realistic skin texture, beige knit sweater,
    dark jeans, eye-level full-body framing, marble floor reflections,
    warm neutral balance, shallow depth of field.
  Use case: Editorial lifestyle photograph.
  Constraints: No watermark, no logos, no extra people, no heavy retouching.
  ```

### 2.2 OpenAI Academy 的「简化口径」

**【官方】**（openai.com/academy）大多数情况 **1–3 句清晰句子就够**，关键是说清五件事：**用途、主体、正在发生什么、在哪、想要的视觉风格**；构图/光线/约束重要才补。**「清晰」胜过「聪明措辞」**——「左边窗户的柔和自然光」永远比「漂亮的光线」可靠。

### 2.3 反 slop 铁律（榨质量的第一道闸）

**【多源】** 兴奋词不会渲染成画面。**写能画出来的视觉事实，不写形容词堆叠：**

| ❌ 空词                                                                        | ✅ 视觉事实                                                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| stunning / incredible / epic / masterpiece / gorgeous / 高级 / 震撼 / 氛围感 / 大片感 | overcast daylight / brushed aluminum / chipped paint / 50mm feel / soft bounce light |
| 8K / ultra-detailed / hyper-realistic                                       | 35mm film grain / shallow depth of field / Kodak Vision3                             |
| minimalist / luxury / premium（无视觉靶）                                         | cream background + heavy black condensed sans + generous negative space              |

> 风格词必须有「视觉靶」：说 `brutalist` 没用，说 `raw concrete, exposed beams, single overhead bulb` 才成立。

---

## 3. 电影级画面提示词技巧（质量命门）

> 核心：**别写「电影感」，写「导演 + 胶片 + 焦段 + 光向」四个具体参照。** 模型对专业术语的响应远好于形容词。

### 3.1 导演锚定（style anchor）

**【多源】** 直接点名导演/摄影师，比「cinematic」有效一个量级：

- **王家卫 Wong Kar-wai** → 手持 + 抽帧 + 暖色霓虹 + 玻璃反射
- **Denis Villeneuve（维伦纽瓦）** → 冷调 + 大负空间 + 慢推轨 + 压迫感
- **Roger Deakins** → 自然主义布光 + 精准逆光
- **Martin Scorsese** → 深黑 + 颗粒粗粝的调色
- **Wes Anderson（韦斯·安德森）** → 高饱和 + 严格对称构图

**写法**：`shot in the style of a Wong Kar-wai film, handheld, warm neon, rain-soaked reflections`。

### 3.2 胶片质感（杀掉塑料感）

**【多源】** AI 默认出「数字塑料脸」，要用胶片词把质感拉回来：

| 目的     | 用词                                                                       |
| ------ | ------------------------------------------------------------------------ |
| 电影感胶片  | `Kodak Vision3 500T`（夜/霓虹）、`Kodak Vision3 250D`（日）、`CineStill 800T`（霓虹夜） |
| 人像柔和高光 | `Kodak Portra 400`                                                       |
| 鲜艳复古   | `Fujifilm Velvia`                                                        |
| 去塑料感   | `35mm film grain`、`halation`、`slight soft contrast`、`ISO 800`            |

> ⚠️ 反面：**别用 `sharp` / `8K` / `high detail`**——会出「游戏 CG 过锐感」，读起来不像电影。

### 3.3 镜头语言（景别 / 焦段 / 光向）

**【多源 + 官方 cookbook】** 用摄影术语替代情绪词：

- **景别（framing，一镜只取一个，别写矛盾景别）**：  
  `extreme wide shot`（大全景）/ `wide shot`（全景）/ `medium shot`（中景·腰上）/ `medium close-up`（中近景·胸上，叙事最稳）/ `close-up`（近景·脸部占满）/ `extreme close-up`（特写·局部细节：眼/手/物）/ `over-the-shoulder`（过肩）
- **焦段（决定主体与背景的空间关系）**：  
  `24mm`（广角·环境开阔）/ `35mm`（叙事主力）/ `50mm`（标准）/ `85mm f/1.4`（人像压缩·浅景深）/ `anamorphic lens`（变形宽银幕·椭圆光斑）
- **光向（质量命门，一次组合 2–3 个光概念）**：
  - 光位：`key from camera left`（主光在左）、`backlit / rim light`（逆光/轮廓光）、`side light`（侧光）、`practical`（场景内光源）
  - 调性：`golden hour`（黄金时刻）、`blue hour`（蓝调）、`low-key`（低调暗调）、`high-key`（高调明亮）、`Rembrandt lighting`（伦勃朗光）、`chiaroscuro`（明暗对比）
  - 光质：`soft diffused`（柔漫）、`hard directional`（硬定向）、`volumetric light`（体积光）

### 3.4 色彩分级（color grade）

**【多源】** 一句话锁定整张图的情绪基调：

- `teal and orange grade`（青橙分级，动作片/商业片最稳）
- `bleach bypass`（漂白留银，硬汉/战争）
- `desaturated earth tones`（去饱和土色，维伦纽瓦式）
- 题材色板速查：**neo-noir**＝冷钢蓝+深品红+湿霓虹反光；**恐怖/惊悚**＝去饱和绿+硬底光+高阴影；**纪录感**＝自然光+略欠曝阴影+中性色温。

### 3.5 构图与画幅（导演思维）

**【多源】**

- **三层构图**：`foreground … midground … background …` 明确前景/中景/后景，真实纵深感秒出。
- **画幅即电影感**：竖屏手机图是电影的反义词。写 `2.39:1` / `2.35:1`（变形宽银幕）或 `widescreen anamorphic`。故事板本厂用 16:9。
- **构图规则**：`rule of thirds`（三分）、`leading lines`（引导线）、`negative space`（负空间）、`Dutch angle`（荷兰角）、`symmetrical framing`（对称）。

### 3.6 一条电影级 keyframe 的完整模板

```
Scene: [地点 + 时间 + 环境]
Subject: [谁 / 什么，在做什么]
Important details: [材质 + 服装 + 光向 + 焦段 + 景别 + 色彩分级 + 大气介质]
Use case: Cinematic storyboard keyframe.
Constraints: No text, no watermark, no extra characters, preserve [固定项].
```

示例：

```
Scene: An empty train station platform at night, light mist in the air.
Subject: A lone musician standing center-frame with a guitar case, looking off-frame.
Important details: wet floor reflections, blue practical station lights,
  wide 24mm lens, low-angle, rim light from behind, teal and orange grade,
  35mm film grain, shallow depth of field, clear negative space on the left.
Use case: Cinematic storyboard keyframe.
Constraints: No text, no watermark, no extra people, no logo.
```

---

## 4. 多轮编辑（img2 的杀手锏）

> img2 相对其它模型最硬的能力：**基于上一张继续改，不重抽。** 官方叫「Edit, don't re-roll」。关键是**每一轮都把「改什么」和「护什么」同时说死**。

### 4.1 编辑三段式公式

**【官方 + 多源】** 编辑用 `Change / Preserve / Constraints`，**`Preserve` 是命门**——没显式锁定的元素会漂：

```
Change only X.
Keep A, B, C, D unchanged.
Match the existing perspective and lighting.
Add no new objects or text.
```

实例（改背景不改产品）：

```
Change only the background from warm cream to muted blue.
Keep the bottle, its label-free shape, size, position, cap, reflections,
  lighting direction and camera framing exactly as they are.
Add no other objects or text.
```

### 4.2 多轮编辑四铁律

1. **一次只改一个变量**：改光就只改光，别同一条里又改构图又改服装。小步迭代比一次大改可评估得多。
2. **Preserve 清单每轮重复**：每次都重念「保持脸/构图/光向/文字不变」，减少漂移累积。
3. **改的先后顺序**：先定**身份与构图** → 再改**服装/道具** → 最后**色彩/收尾细节**。
4. **满意就存档**：每轮通过后先存版本，再进下一轮——后面的编辑可能撤销你前面想保留的东西。

### 4.3 参考图「一图一职」

**【多源】** 多图输入时必须显式声明每张图管什么，否则模型会从错误的图里借脸：

```
Use Image 1 only for the subject's exact face, likeness and skin tone.
Use Image 2 only for the room, clothing, pose and lighting.
Make a new full-colour portrait of the subject from Image 1 in the scene from Image 2.
Do not copy the person from Image 2.
```

> ⚠️ 别描述参考图里已有人物的发型/五官，除非你**故意**要改——文字描述会跟上传的图打架。

### 4.4 定点改图（图片评论）

**【官方】** 2.5 新交互「图片评论」：在已生成图上**圈选区域 + 写批注**，指哪改哪、其余不动。适合「改这半边脸/这个道具，别的别动」的精准修改，比纯文字描述空间位置更省事。`@Sketch` 手绘草图管构图、文字管内容。

---

## 5. img2 出故事板的正确姿势

> 故事板是**视觉计划，不是成品**：先锁死构图/景别/光向，视频模型只负责「动起来」。img2 质量最高，就用在「把这张视觉底本打准」上。

### 5.1 锁三样：构图 + 景别 + 光向

**【多源】** 故事板＝**连续性圣经（continuity bible）**，先记死哪些绝对不能变：

| 必须锁死的项 | 在提示词里怎么写                                                                                      |
| ------ | --------------------------------------------------------------------------------------------- |
| 构图     | `rule of thirds`、`subject centered, negative space on left`、`foreground/midground/background` |
| 景别     | 每格明确写 `wide shot` / `medium shot` / `close-up`，一格一个，不混                                        |
| 光向     | `key from camera left` / `backlit` / `practical lamps in frame`，同一场景同一光向复用                    |
| 画幅     | 16:9（本厂口径）；电影感可 2.39:1                                                                        |
| 风格     | 定 3–5 个主色 + 一种胶片质感 + 一个导演参照，全程复用                                                              |


> 一致性靠**语言的重复**：角色描述、环境、光线在每条提示词里用**一模一样的话**，别换说法——换个说法漂移就开始了。

### 5.2 参考图怎么用（三视图传身份）

**【本厂口径 + 多源】** 三步分工：

1. **三视图（角色板）= 锁人物**：作为参考图传入，锁长相/服装/细节一致。
2. **故事板图 = 锁画面**：构图、景别、动作示意、分镜节奏。
3. **视频提示词 = 定动态**：只写动作 + 氛围，不重复图里已有的外貌。

**参考图传入时的铁律**：显式声明角色分工，`Use Image 1 only for the character's exact face and wardrobe`，避免多图打架。

### 5.3 两种故事板出法

**A. 单帧 keyframe（逐镜出，精度最高，推荐）**  
每镜单独一张，锁死构图/景别/光向，作为该镜的视觉锚点。适合需要逐镜打磨的正式故事板。

**B. 多格分镜图（一次出 4 格，快速总览）**

```
一张写实且具电影感的 4 格分镜图（storyboard infographic），
35mm film 质感，场景[地点+时间]，主要角色特征全程一致。
分镜内容：1. 中景 … 2. 特写 … 3. 动作 … 4. 远景 …
```

> ⚠️ 多格图优点是快，缺点是单格精度低、后接视频时要把格子裁开用。**正式故事板以单帧 keyframe 为准，多格图只用于前期找方向。**

### 5.4 Flare / Sunburst 在故事板里的分工

- **前期找方向**：Flare 快速出多版构图/景别/光向，先看哪版对。
- **定稿锁一致**：方向定了，切 **Sunburst** 出定稿，锁人物一致性 + 构图 + 光向。
- **跨镜续作**：同一角色的后续镜头，把上一张定稿 + 三视图一起传入 Sunburst，保持跨镜不漂。

---

## 6. 中英文差异与混用策略

**【多源】**（五竹知识库 / CSDN 实测 / flux-art + 本厂情报，结论一致）

| 对比项     | 中文         | 英文                                              |
| ------- | ---------- | ----------------------------------------------- |
| 日常场景理解  | 很好，够用      | 略好                                              |
| 摄影/设计术语 | 表达不精确      | **更稳**（`35mm` / `f/1.8` / `cinematic lighting`） |
| 风格词     | 部分中文不够精确   | 英文术语更丰富                                         |
| 图片内文字渲染 | **中文渲染很好** | 英文渲染很好                                          |
| 属性绑定    | 有歧义坑（见下）   | 更稳定                                             |

**结论：混用最优。**

- **中文写**：主体、氛围、意境、文化意象（「雨后清晨的江南小巷」「廊下风穿堂而过」）。
- **英文写**：镜头运动、景别、光线方向、胶片型号、风格词、负面约束。
- **示例**：
  ```
  故宫雪景，一位穿旗袍的女子撑伞站在红墙前，旁边有红梅，地面有积雪，
  Kodak Portra 400 film tone, grain texture, 50mm lens f/2.0, medium shot,
  画面氛围安静优雅。
  ```

**中文提示词的隐藏坑（属性绑定）**：

- ❌ `一个红色的陶瓷花瓶和白色的玫瑰花`——模型可能分不清「红色」是花瓶还是玫瑰。
- ✅ `一个红釉陶瓷花瓶，插着一束白色玫瑰`——**把颜色属性拼进名词里**，减少歧义。

**图片里要出现的文字**：用什么语言就写什么语言，用引号括起来；关键文字加 `Render verbatim`（逐字渲染）守卫；生僻词/品牌名逐字母拼写 `S-T-R-I-P-E`。复杂中文排版生成后仍需肉眼复核，必要时后期替换。

---

## 7. 可直接复制的模板库

### 7.1 电影级单帧 keyframe（故事板主力）

```
Scene: [地点 + 时间 + 环境]
Subject: [谁 / 什么，在做什么]
Important details: [材质 + 服装 + 光向 key from camera left/backlit + 焦段 35mm/85mm
  + 景别 medium close-up + 色彩分级 teal and orange + 大气介质 mist/rain/dust]
Use case: Cinematic storyboard keyframe.
Constraints: No text, no watermark, no extra characters, preserve [固定项].
```

### 7.2 参考图角色分工（多图输入）

```
Use Image 1 only for the character's exact face, hairstyle and wardrobe.
Use Image 2 only for the scene, lighting and camera framing.
Keep the character's facial features exactly the same as Image 1.
Create a full-colour storyboard frame of the character in the scene from Image 2.
```

### 7.3 精准编辑（改一处护全局）

```
Change only [要改的].
Keep [护住的：face, pose, framing, lighting direction, background, geometry, text] unchanged.
Match the existing perspective and lighting.
Add no new objects or text.
```

### 7.4 多格分镜总览（前期找方向）

```
一张写实且具电影感的 [N] 格分镜图（storyboard infographic），35mm film 质感。
场景：[地点 + 时间]。主要角色特征全程保持一致。
分镜内容：1. [景别] [动作]；2. [景别] [动作]；… N. [景别] [动作]。
8k 超高清写实质感（如追求电影感改 35mm film grain 而非 8k）。
```

---

## 8. 常见翻车与修法

| 症状            | 根因                        | 修法                                                      |
| ------------- | ------------------------- | ------------------------------------------------------- |
| 画面塑料感 / 游戏 CG | 用了 `8K/sharp/high detail` | 改 `35mm film grain / shallow depth of field / halation` |
| 风格冲突          | 提示词自相矛盾（油画+照片写实）          | 一稿只走一个风格方向                                              |
| 多轮编辑越改越偏      | Preserve 清单没重复            | 每轮重念「保持 X 不变」                                           |
| 参考图借错脸        | 多图没声明分工                   | 显式 `Use Image 1 only for face`                          |
| 生成出多余文字/水印    | 模型自主补字                    | Constraints 加 `No text, no watermark, no subtitles`     |
| 中文属性错绑        | 颜色/属性与名词分离                | 属性拼进名词：`红釉陶瓷花瓶`                                         |
| 复杂中文排版乱码      | 文字渲染长文本仍弱                 | 逐字拼写 + 生成后复核 + 必要时后期替换                                  |
| 抽象词失效         | 写「电影感/高级」                 | 锚定导演/胶片/焦段/光向具体参照                                       |

---

## 附：来源性质一览

- **官方结构（Scene→Subject→Details→Use case→Constraints）**：OpenAI 官方 cookbook `image-gen prompting guide`、openai.com/academy、fal.ai 官方模板、微信公众号官方口径——四源一致。
- **Flare/Sunburst 定位与 2.5 改进**：OpenAI 2026-09-08 公告 + kanaries / getmodelkey / pixmira / vidmuse / pixverse / techyden 多篇交叉一致。
- **电影级技巧（导演/胶片/镜头/分级）**：text2img.pro / freshtechtips / felloai / 本厂 `电影风格手册` 与 `prompt-intel.md` 交叉一致。
- **中英文差异**：五竹知识库 / CSDN 实测 / flux-art 与本厂情报，结论一致。
- **故事板（连续性圣经 + 一图一职）**：domer.io / promptifyvideo.com / promptybox / unwire.hk 实战 + 本厂 storyboard Skill。
