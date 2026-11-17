# 09 · 中英词表：把中文需求翻成模型听得懂的话

> 用户说中文，模型吃英文。这份表是翻译层。 **规则：中文用来沟通，英文用来提交。** 提示词正文一律英文（除非用户明确要求中文正文）。

---

## 1. 景别 Shot size

中文English一句用途大远景extreme wide shot交代地理，人物很小远景 / 全景wide shot建立空间中全景medium wide shot人和环境都看得清中景medium shot腰以上，动作最清楚中近景medium close-up (MCU)胸以上，竖屏主力景别近景close-up (CU)肩以上，情绪特写tight close-up脸占满大特写extreme close-up (ECU)只给眼睛/嘴微距插入macro insert物件、纹理、手指过肩over-the-shoulder (OTS)对峙主观POV代入双人two-shot关系侧面profile冷静、距离剪影silhouette隐藏身份仰拍low angle权力、威胁俯拍 / 顶拍high angle / top-down审判、渺小斜角dutch angle失衡定镜locked-off frame / static压住不动

---

## 2. 运镜 Camera movement

中文English备注定镜static camera / camera fixed一镜一运镜原则的"零"选项慢推slow push-in加压最常用快推fast push-in只用在冲击拉远pull-back / dolly-out揭示语境跟拍tracking shot跟随主体横移lateral tracking旁观感手持微抖handheld micro-shake纪实、焦虑甩镜whip pan转场、暴力急推变焦snap zoom惊讶一拍变焦转移rack focus引导注意力上摇 / 下摇tilt up / tilt down纵向揭示环绕orbit英雄感、仪式感稳定器滑行gimbal glide平滑旁观升降crane shot大尺度航拍aerial shot建立希区柯克变焦Hitchcock zoom / dolly-zoom眩晕、失衡

**格式塔规则**：**一镜一个主运镜**，最多加一个微调。写两个以上，模型会糊。

---

## 3. 焦段 Lens

焦段English感受24mm24mm广、沉浸、空间被夸张35mm35mm自然纪实50mm50mm亲密人眼视角85mm85mm肖像、背景压缩100mm macro100mm macro质感微距40mm 变形宽银幕anamorphic 40mm宽银幕、横向光斑

配套英文：`shallow depth of field`（浅景深）、`deep focus`（深焦）、`compressed telephoto background`（长焦压缩）。

---

## 4. 光源 Source

中文English冰箱冷光cold refrigerator light厨房顶灯harsh overhead kitchen LED窗外月光moonlight through window霓虹溢出neon sign spill手机屏幕光phone screen glow车头灯car headlights路灯逆光streetlamp backlight办公室荧光灯fluorescent office light实景台灯practical lamp烛光candlelight显示器光monitor glow应急红光emergency red light钠灯sodium vapor street light警灯police strobe舞台聚光stage spotlight篝火campfire flicker百叶窗夕阳sunset through blinds

---

## 5. 光位与光质 Direction & quality

中文English顶光top light侧光side light逆光backlight底光underlight正面柔光frontal soft light轮廓光rim light反弹补光bounce fill窗光作主光window key light画面内可见光源motivated practical硬阴影hard shadow柔散光soft diffused低调光low-key lighting高反差high contrast高光点specular highlights体积雾volumetric haze蒸汽被逆光打亮steam catching backlight湿面反光wet reflections降饱和desaturated palette冷蓝灰调cold blue-gray grade青绿阴影teal shadows干净的商业光clean commercial lighting粗粝自然gritty naturalistic过曝blown-out overexposure压死的黑crushed blacks

**必写三件**：光源是什么 + 从哪个方向 + 硬还是柔。

---

## 6. 色板预设 Palette presets

名称英文写法芬奇冷cold blue-gray shadows, desaturated skin, black negative space迪金斯自然warm amber interiors, cool blue exteriors, clean contrast王家卫saturated warm reds, deep greens, hazy practicals格雷泽霓虹black base, one dominant neon hue (magenta or teal), hard edges商业奶油warm creams, soft pastels, clean whites, no harsh blacks萨弗迪混乱mixed sources, overlapping color temperatures, urban neon spill国漫冷艳deep ink black, jade green, cinnabar red accent, paper white highlights

**写法纪律**：3–5 色，给 hex 更好。`#1B2430` 比 `deep blue` 稳。

---

## 7. 声音 Sound

类别中文English环境房间底噪room tone环境远处城市distant city ambience环境铁皮屋顶的雨rain on tin roof环境冰箱嗡鸣fridge hum环境荧光灯电流声fluorescent buzz环境车流traffic wash身体呼吸breath身体脚步footsteps身体衣料摩擦fabric rustle身体吞咽a hard swallow动作叉子碰盘fork clink动作门轴door hinge动作钥匙入锁key in lock动作拉链zipper事件突然的静音sudden silence事件低频撞击low bass hit事件湿闷的落地声wet thud事件玻璃碎裂glass break事件车门关上car door slam事件切黑前的最后一声final sound cue before cut to black

**写法**：声音要给时间点或位置。`one stomach growl at 2.3s` 比 `hungry sounds` 强。

---

## 8. 走位 Blocking（六个输入）

写走位必答六问：

1. 谁在动
2. 从哪开始
3. 到哪结束
4. 碰了什么物件
5. 在看什么
6. 身体泄露了什么情绪

示例：

```text
The man stands in the kitchen doorway, shoulders collapsed. He edges toward the refrigerator, opens it with hesitation, leans into the cold light, then freezes when he sees the empty shelves.
```

这比 `a sad man goes to the fridge` 强，因为模型可以逐帧执行。

---

## 9. 时间与节奏 Timing

中文English入点 / 出点in / out时长duration段落点 / 最后一帧final frame / end on首帧first frame静止一拍hold one beat突然的静音cut to silence剪辑阶梯rhythmic staircase变速speed ramp慢动作slow motion定格freeze frame匹配切match cut硬切hard cut / smash cut动作切cut on action声先入J-cut声后出L-cut

---

## 10. 画幅与参数 Aspect & params

用途画幅分辨率建议竖屏短视频 / 短剧 / 漫剧9:161080×1920横屏影视感16:91920×1080 / 3840×2160宽银幕21:9 / 2.39:12560×1080方形社媒1:11080×1080竖长海报3:4 / 4:51080×1440

**比例与分辨率不写进提示词正文**，放参数行（`Ratio: 9:16`）。正文只描述画面。

---

*词表改编自 Serge Shima《visual-skills》camera-lighting-vocabulary.md 并做中英对照扩充（CC BY 4.0）。*