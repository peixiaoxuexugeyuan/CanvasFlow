# Midjourney Output

每次默认双版本交付时读取。最后核对官方文档时间：2026-07-15；当用户指定其他版本或参数出现兼容性疑问时，重新检查官方文档。

## Output Contract

```text
【Image Prompt】
<原始中文导演型 prompt，2-4 段>

【Midjourney Prompt】
<英文单段正文> <末尾参数>
```

不要把中文版本删掉，也不要把 Midjourney 版本做成逐句对照翻译。两个版本必须锁定相同主体、机位、事件阶段、光线和视觉层级。

## English Prompt Order

按以下优先级压缩：

1. 主体和核心环境。
2. 观看身份、摄影机位置、景别和构图。
3. 动作中间态、事件阶段和可见后果。
4. 第一视觉、尺度关系和主要叙事压力。
5. 光源、明暗骨架、强调色和空气介质。
6. 材质、摄影、动漫、CG 或插画语言。
7. 参数。

使用清楚的英文视觉短语和主动关系，例如 `seen from behind a rain-streaked windshield`、`a tiny figure used only as a scale anchor`、`the shockwave has not reached the camera yet`。少用抽象词，如 `epic`、`masterpiece`、`cinematic`；只有具体画面关系已经写清时才保留少量气质词。

## Parameter Placement

所有参数放在正文末尾，参数后不再添加描述或标点。每个参数前保留空格，不把参数插入句子中。

默认参数选择：

- `--ar W:H`：根据用户画幅添加；比例使用整数，如 `--ar 16:9`、`--ar 2:3`。
- `--raw`：写实摄影、建筑环境、精确构图或已经提供详细风格语言时使用，以减少 Midjourney 自动风格化。
- `--s N`：需要控制艺术解释程度时使用。精确导演关系可倾向 50-150；表现性概念图可倾向 150-400；没有明确理由时省略，使用平台默认值。
- `--no item1, item2`：只排除少数具体可见元素。优先正向描述，不写抽象的 `AI look`。避免可能被拆开误读的复杂短语。
- `--chaos N`：只在用户要求探索性变体时使用，默认省略。
- `--hd`：仅在用户明确需要 V8.1 HD 输出并接受额外资源成本时使用，默认省略。
- `--v 8.1`：只在用户要求锁定当前版本时添加，默认使用用户设置中的模型版本。
- `--niji 7`：用户明确需要 Midjourney 动漫模型时使用；不要与 `--v 8.1` 同时使用。

不要为 V8.1 添加 `--q`；当前 V8.1不支持 Quality 参数。不要默认使用旧式 `::` 多提示词权重；当前 V7 和 V8.1不支持 Multi-Prompting。

## Reference Images

- 普通 Image Prompt：把有效图片 URL 放在文本正文前；当前 V8.1/V7可用 `--iw 0-3`，Niji 7可用 `--iw 0-2`。
- Style Reference：用户提供风格参考 URL 时使用 `--sref URL`，需要时用 `--sw` 调节权重；正文仍然描述内容，不写“把参考图修改成”。
- Omni Reference：只在用户选择兼容的 V7 流程并提供有效 URL 时使用 `--oref`；V8.1不使用 Omni Reference。
- 本地文件路径不能直接代替在线图片 URL。不要虚构地址或留下无法执行的伪参数。

## Text In Images

需要画面文字时，在英文正文中使用双引号包住准确文字，并说明它是 written text。文字尽量短，优先使用拉丁字母；没有文字需求时加入正向约束 `text-free image`，只有水印风险明显时才考虑 `--no text, watermark, logo`。

## Multi-Shot Output

镜头组为每个镜头分别输出一对 Image/Midjourney Prompt。每条 Midjourney Prompt 必须能独立复制；重复必要的一致性锚点，不写 `same as above`。

除非用户明确要求一张拼贴图，不要在一条 Midjourney Prompt 中描述多个镜头。当前 V7/V8.1不支持旧式多提示词分段权重，不要用 `::` 解决镜头组。

## Medium Presets

- 写实电影/建筑：具体摄影或虚拟摄影语言 + `--raw` + 低到中等 stylize。
- 环境概念图：大形、尺度锚点、明暗骨架和设计母题优先，可用中等 stylize。
- 硬闪时尚：写清 direct on-camera flash、underexposed ambient、flash-frozen subject、directional light trails；通常使用 `--raw`。
- 动漫：使用清楚的二维语言和角色动作，需要 Niji 时使用 `--niji 7`。
- CG/游戏：写清设计、材质和渲染语言，不用“8K”代替结构。

## Official References

- Prompt Basics: https://docs.midjourney.com/hc/en-us/articles/32023408776205-Prompt-Basics
- Parameter List: https://docs.midjourney.com/hc/en-us/articles/32859204029709-Parameter-List
- Version Compatibility: https://docs.midjourney.com/hc/en-us/articles/32199405667853-Version
- Aspect Ratio: https://docs.midjourney.com/hc/en-us/articles/31894244298125-Aspect-Ratio
- Raw: https://docs.midjourney.com/hc/en-us/articles/32634113811853-Raw
- Image Prompts: https://docs.midjourney.com/hc/en-us/articles/32040250122381-Image-Prompts
- Style Reference: https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference
