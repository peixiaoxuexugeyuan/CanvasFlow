# Audio Policy — VO and Sound Effects Only

This is a global, user-approved hard rule for every image/video model-facing prompt produced by this skill.

## Scope separation

The rule does not prohibit a separately requested AI-music brief or music-generation prompt. That material
must live in a dedicated music artifact or future sibling module and must never be embedded in, inherited by
or referenced from an image/video-generation prompt. A combined TVC package may contain both only as clearly
separated deliverables: `visual generation prompts` and `AI music brief`.

## Allowed

- Voice-over and approved dialogue.
- Production sound and ambience: room tone, city bed, wind, rain, water, crowd, machinery.
- Foley: footsteps, fabric, breath, touch, handling, doors, switches.
- Product and action effects: click, lock, motor, impact, whoosh, pressure release, electronic cue.
- Designed non-musical sound effects and intentional silence.

## Forbidden in prompts

- Music, BGM, score, soundtrack, instrumental beds or songs.
- Musical genre, melody, harmony, rhythm-section or instrument instructions.
- Requests to inherit or reproduce music from an audio/video reference.
- Phrases that tell the generation model to add, compose, continue or synchronize to music.

## Handling supplied music

Do not reference it in a generation prompt and do not translate it into musical language. Flag it as excluded
by project policy. If timing marks are required, the user must provide or approve non-musical edit markers or
SFX/VO anchors instead.

## Prompt audio block

Use only:

`VO/dialogue → ambience → foley/action SFX → designed SFX → sync points → silence`

Omit empty categories. Do not add an audio block when the user has not requested audio and none is needed.

## Pre-delivery scan

Before delivering any image/video prompt, scan the model-facing text case-insensitively for music-related terms
in Chinese and English, including `音乐`, `配乐`, `背景音乐`, `BGM`, `music`, `musical`, `score`, `soundtrack`,
`song`, `melody`, `instrumental`, and instrument names used as audio direction. Rewrite or remove every match.
Historical research notes, user quotations and separately labelled AI-music artifacts may retain these words;
image/video-generation prompts may not.
