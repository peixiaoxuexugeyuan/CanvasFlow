# V8格式结构详细模板（12子段标准）

> 每次写CLIP提示词，STYLE LOCK段必须包含以下全部子段。缺一不可。写之前先翻项目中最接近的同类已完成CLIP对齐。

## STYLE LOCK段必含8子段

### ①一句话风格锁定

Ultra-detailed cinematic film。画幅（如2.35:1 anamorphic）。4K。运镜方式概述。BGM状态（无BGM写"No BGM"，有BGM写明曲目/风格）。

### ②色调

色卡融入叙述一段压完。写明primary/cold比例、光源类型、No fill/beauty/rim light without source。

- 冷色调场景：天空暗冷蓝灰，100%冷色零暖色
- 暖色调场景：暖光主调但需有冷色平衡
- 色卡中色号保留在参考图提示词中，CLIP提示词中取消色号改用描述性语言

### ③质感

Kodak胶片模拟。室内低光用500T 5219（tungsten），室外日光用250D 5207（daylight）。Fine organic grain, no digital noise。Anamorphic oval bokeh。DARK AREAS not pure black。

### ④电影质感锁定

Live action not animation/CGI/game。Physical camera + anamorphic lens。Real film stock characteristics。Camera movement description。Optical characteristics。

### ⑤物理照明锁定

光源数量/位置/角度。光衰减物理。表面反射类型（diffuse/specular）。阴影特性（never pure black + ambient bounce）。大气条件。

**2.5升级（必写）**：光源-角色皮肤交互。写明每个光源照到角色哪个部位、产生什么色温区、反射光从哪来打到哪、阴影投在哪。不写=角色皮肤与环境脱节。示例："Cold sky-light from above casts head and shoulders in cold blue-grey. Torch from right throws warm orange on right face and arm. Ground moisture reflects cold grey onto jaw and under-chin. Three temperature zones on skin." 详见 `seedance_25_execution_model.md` 第四节。

### ⑥人物运动物理锁定

站立重心链（feet→knees→hips→spine）。气流/风对衣物的影响（fabric follows mass and air resistance, not floating）。走步步态。转头颈部发力。所有运动有惯性和重量。

**2.5升级（必写）**：全身动力学链。每个角色每个动作写全四层面——主动件+稳定件+补偿件+不自主反应。2.5只执行你写的部位，没写的不动。即使"站立不动"也要写重心脚/手臂位置/呼吸起伏/身体微晃。详见 `seedance_25_execution_model.md` 第二节。

**2.5升级（必写）**：情绪→物理分解。禁止所有情绪词（笑/怒/悲/犹豫等），替换为可见肌肉动作。"嘴角抬起2mm"不写"微笑"。详见 `seedance_25_execution_model.md` 第一节。

**2.5升级（必写）**：环境动态。每个Shot至少3-4个环境动态元素（风/灰尘/雾/光焰/水/生物）。不写=死画面。详见 `seedance_25_execution_model.md` 第三节。

### ⑦场景特定物理规则（视场景而定）

如暗金能量物理/龙飞越物理/水流物理/管道侵蚀物理等。纯物理描述，no magic。

### ⑧严格N人声明

角色数量锁定。No clones。如"画面中严格只有3个人类角色，禁止角色复制"。

## CLIP段必含3子段

### ⑨首帧声明

场景。时间。光线。人物位置/状态。色调。一句话设定画面。

### ⑩逐秒拆解

`[0-1s] [1-2s] [2-3s]`格式。每秒写明：主体动作 + 镜头运动 + 光影变化 + 物理细节。上一段结束状态=下一段起始状态，不重叠不留空。

**2.5升级（必写）**：四层画面枚举。每秒写全四层：

- **前景层**（0-2m）：物体/碎片/障碍物的材质+光照+运动状态
- **中景层**（2-8m，角色层）：角色全身动力学链+情绪物理分解+光照-皮肤交互+与环境接触面物理
- **背景层**（8m+）：建筑/人群/远处光源+大气透视+背景动态
- **空气层**（贯穿全画面）：灰尘/雾/烟/蒸汽/风/温度可视物+丁达尔效应

2.5不推理不补充，每层不写=画面里没有。一个5s Shot可能需要300-500字描述。详见 `seedance_25_execution_model.md` 第五节。

### ⑪微动作全程

按阶段总结关键动作链，每阶段一句话。如"独站/龙过/汇合/眺望"各阶段的核心动作。

## 结尾必含1子段

### ⑫\[NEGATIVE\]

场景特定否定指令。不堆通用词，每个否定指令对应本场景可能出现的具体错误。不引用Shot编号（整体粘贴时模型对不上）。负面词本身会污染模型注意力，能转正向的转正向。

## V8 vs V7变化对照

变化点V7V8Shot内格式6维度散文式时间段标注：`【时间】起始+动作+运镜+结束`BGM/声音散落在每个Shot独立段统一管理限制通用负面spam二三十条3-8项精准限制风格段STYLE LOCKSTYLE LOCK + 补充时长/画幅声明素材声明参考图锚定参考图锚定 + 素材职责声明

## STYLE LOCK标准模板示例

```
Cinematic film。Low Key Lighting。冷灰蓝黑为绝对主色调（90%+）。光源体系（所有光源必须有真实物理来源，禁止凭空出现暖光）：①主光源描述；②辅助光源描述；③反射光源描述；④大气光效描述。Anamorphic 2.35:1。4K, cinematic film rendering, fine organic grain, no digital noise, smooth gradient in dark areas。Consistent motion blur on all movement, natural depth of field。画面中严格只有[N]个人物角色，禁止角色复制。

材质系统：[场景材质描述]。所有物体接地有contact shadow。禁止塑料质感/泥泞噪点/无序反光。
```

## 参考图全局锁定写法

```
@Image1 角色：identity/outfit/关键特征
@Image2 角色：identity/outfit/关键特征
以上各图均为唯一参考，禁止偏离。每张图只控制上述指定属性，禁止覆盖其他角色或场景。全局锁定，后续不再重复@声明。
```

## 负面限制选题库（从中选取3-8项与本场景最相关的，不要全贴）

```
no character identity drift, no extra characters, no blue-purple glow, no neon, no plastic skin, no muddy texture, no blur on focused subject, no silent footsteps, no eye color, no friend fire, no static posing, no overexposed whites, no crushed blacks, no floating objects without contact shadow, no sourceless warm light, no independent subject lighting, no warm light without physical origin, no frame skipping, no stutter, no choppy motion, no character duplication, no cloned characters, no extra copies of same character
```