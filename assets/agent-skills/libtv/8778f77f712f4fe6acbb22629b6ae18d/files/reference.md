# paper-collage-fable — reference

## Vernacular narration sources

优先顺序：

1. 用户指定的白话文本
2. 通行儿童/教材白话改写（非《吕氏春秋》原文）
3. 自行改写：口语、短句、有画面

禁止：产品说明书腔、堆砌寓意说教、文言夹白话。

## Five-beat story shape

1. **起势**：道具/人物登场，制造「怎么回事」
2. **冲突**：常规办法失败或危险出现
3. **转机**：主角提出/做出非常规举动
4. **行动**：核心动作落地（砸缸、画吃水线、捂耳…）
5. **点题**：结果 + 纸签故事名

## Continuity checklist per keyframe

- \[ \] 同一纸场 hex
- \[ \] 主角服饰/发型一致
- \[ \] 主道具（缸/象/钟/船）造型一致
- \[ \] 片尾纸签汉字与故事名完全一致
- \[ \] 无多余英文/水印

## ASS timing

对每场：`start = scene_offset + voiceStart`，在旁白时长内均分拆行；`end` 不超过 `scene_offset + duration - 0.05`。

## Windows notes

- edge-tts 前清空 `HTTP(S)_PROXY`
- ASS 用 `utf-8-sig`
- ffmpeg `ass=` 过滤器优先用**项目相对路径**（在项目根执行）
- `assemble.mjs` 的 base 是 manifest 所在目录

## Dependencies

```text
ffmpeg, ffprobe, node >= 18, python 3, edge-tts
optional: belt (Seedance)
paper-collage-ad assemble: ~/.agents/skills/paper-collage-ad/scripts/assemble.mjs
```