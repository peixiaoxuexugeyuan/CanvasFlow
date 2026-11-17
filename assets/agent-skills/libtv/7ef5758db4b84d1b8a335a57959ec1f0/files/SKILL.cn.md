---
name: triple-fx-brand-motion
display-name-zh: 三效叠加品牌动效
version: 0.1.0
tag-en: "Brand & Marketing"
tag-cn: "品牌营销"
complete-tags-en:
  - "品牌营销 / 创作生成"
complete-tags-cn:
  - "品牌营销 / 创作生成"
summary-en: "Layer crystal shatter/growth, dot-matrix particle assembly, and dual-color neon streams simultaneously to reveal a brand wordmark from pure black to clean freeze frame."
summary-cn: "将晶体碎裂/生长、点阵粒子聚合、双色霓虹流线三效同时叠加，从纯黑驱动品牌字标从零浮现至干净定格。"
description: |
  将晶体碎裂/生长、点阵粒子聚合、双色霓虹流线三种特效同时叠加在同一画面中，从纯黑开场出发，三层动效并发驱动品牌字标从无到有逐步浮现，最终干净定格。适用于科技品牌片头、高密度视觉冲击的logo reveal动效。
desc-en: "This skill takes a brand wordmark image as the visual anchor, analyzes letterform structure and stroke geometry, then composes a three-phase 15-second 16:9 prompt where all three effects run simultaneously: crystal shatter/growth along stroke edges, glowing particle assembly tracing letterform outlines, and dual-color neon streams orbiting the assembling wordmark. A confirmation card aligns wordmark text, color tone, background color, duration, and layer retention before generation. Hard prohibitions: opening wordmark silhouette, sequential three-layer playback, people, extra text, platform watermarks."
desc-cn: "本 Skill 以品牌字标图片为视觉锚点，分析字形结构与笔画走向，按三阶段结构编写 15 秒 16:9 提示词，三层特效同时并发：晶体碎裂/生长沿笔画边缘聚集、粒子聚合勾勒字形轮廓、双色霓虹流线围绕字形旋绕。生成前通过确认卡对齐字标文字、色调、背景色、时长和特效层保留情况。禁止：开场字标轮廓、三层特效顺序播放、人物、额外文字、平台水印。"
author-en: "MiniMax Design"
author-cn: "MiniMax Design"
source: community
trigger-words: [三效叠加动效, 晶体点阵流线, 复合品牌动效, 三层特效叠加, 晶体流线动效, 品牌复合片头, triple fx brand motion, crystal particle stream logo, layered brand reveal, multi-fx logo animation]
allowed-tools: [question, hub_analyse_media, hub_generate_image, hub_generate_video, hub_canvas_get_node]
---

# 三效叠加品牌动效

将晶体碎裂/生长、点阵粒子聚合、双色霓虹流线三种特效同时叠加在同一画面中，从纯黑开场出发，三层动效并发驱动品牌字标从无到有逐步浮现，最终干净定格。

## 步骤 1：识别素材与目标

获取用户提供的品牌字标图片作为视觉锚点，识别：可读文字内容、字形结构（笔画走向、镂空区域、负空间）、字标色调、版式。只有字标内容或目标时长确实不明确时才提问。

## 步骤 2：分析字标结构

识别字标中每个笔画的走向、端点、转角、镂空线槽位置，以及字母/汉字的几何负空间形态。明确字标最终色调（冷白蓝/杏肤色/银灰等）与背景色（默认极深海军蓝近黑#050A14）。

## 步骤 3：编写三段提示词

按以下三阶段结构编写完整提示词，时长15秒，16:9，1080p，Minimax H3模型：

**核心规则：**
- 开场画面必须完全纯黑，绝对禁止预先显示字标、文字轮廓或logo形态
- 三种特效必须同时叠加在同一画面中并发进行，不得顺序播放
- 字标只能由三层特效共同从零浮现，最终结尾完整定格

**第一阶段（00:00–00:02）纯黑开场：**
绝对纯黑，无任何元素，仅有极微弱环境光，低沉工业合成器铺底。

**第二阶段（00:02–00:12）三层特效同时叠加：**

第一层——晶体碎裂与生长：透明多面晶体球从画面上方坠落，撞击后粉碎为尖锐透明多边形碎片向四周飞溅；碎片随后沿字标笔画边缘聚集、结晶生长，晶体簇沿汉字横笔画镂空槽与英文字母几何轮廓攀附包裹，侧后方冷硬光产生强反射折射。

第二层——粒子聚合（与第一层同时）：大量杏肤色发光粒子从四周向画面中央汇聚，与晶体碎片共同在字标笔画区域拼合，粒子轨迹沿字形轮廓延伸，逐步从零勾勒出字标字形轮廓。

第三层——双色霓虹流线（与前两层同时）：宝蓝色与杏肤色双色霓虹光线在画面中穿梭流动，围绕正在聚合中的字形旋绕，能量节点在笔画交叉处持续闪烁爆发，光线与粒子、晶体碎片在同一空间中交织叠加。

三层特效在画面中同时可见、相互穿插，共同推动字形从无到有逐渐浮现。

**第三阶段（00:12–00:15）收束定格：**
所有晶体、粒子、流线同步消散，字标完整清晰地静止定格于画面中央，四周大面积留白，干净尾帧，无多余元素。

## 步骤 4：确认卡

展示提示词摘要，确认以下参数：字标文字内容、字标色调、背景色、时长（默认15秒）、画幅（默认16:9）、三层特效是否全部保留（默认全保留）。

## 步骤 5：生成与检查

确认后生成视频。检查：开场是否纯黑无字标、三层特效是否同时叠加（非顺序播放）、字标是否从零浮现（非预先显示）、尾帧是否干净。失败时仅用结构明显不同的提示词重试，保留字标事实。

## 边界

适合科技品牌片头、高密度视觉冲击的logo reveal。不用于预先显示字标、单一特效、顺序播放动效、长篇广告或普通剪辑。禁止：开场字标轮廓、三层特效顺序播放、人物、额外文字、平台水印。