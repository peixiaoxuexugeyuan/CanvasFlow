# Reconstruction Audit and Dual-Model Delivery Gate

Run internally before every final prompt delivery. Do not print this checklist.

## A. Shot completeness

- Watch the entire segment at least twice.
- Mark every cut, insert, flash, reaction, occlusion cut, whip transition, and continuous take.
- Build a numbered shot ledger.
- Confirm `audited shot count = Seedance timeline count = Kling Shot count`.
- Confirm first block starts at 00:00 and last ends at 00:10.
- Confirm adjacent blocks have no accidental gap or overlap.
- Do not merge short shots for convenience.

## B. Dialogue completeness

- Audit audio independently.
- Count every intelligible foreground spoken unit, including off-screen speech, interruptions, whispers, shouts, and partial lines.
- Record speaker, Chinese transcript, time, emotion, pause, and final English line.
- Confirm `Chinese count = English count = Seedance dialogue count = Kling in-shot dialogue count`.
- Confirm each Seedance line appears in the correct shot and dialogue ledger.
- Confirm each Kling line appears exactly once in the correct `Shot N` block.
- Confirm no Chinese foreground speech or bilingual overlap remains.
- If a line is unclear, block delivery and request confirmation.

## C. Kling principal-subject confirmation

- Derive principal-character candidates from the shot and dialogue ledgers.
- Confirm each speaking, plot-driving, recurring, or user-designated replacement role with the user.
- Record exactly one Kling subject-element name, reference source, and voice-bound state for each principal role.
- If any mapping is missing or ambiguous, stop at `主体绑定待确认` and ask the single question from `kling-subject-binding.md`.
- Confirm the answer has not already been provided before asking.
- Confirm no anonymous extra is unnecessarily bound.
- Confirm no superseded role, image, element name, or voice state remains after replacement.
- Confirm Seedance image mapping and Kling subject mapping represent the same new character identities.
- Block delivery until this gate passes.

## D. Audio events

- Map every BGM change, hit, stop, rise, silence, ambience transition, Foley event, and sound bridge.
- For S02+, confirm both prompts inherit the exact BGM phrase, beat phase, ambience, reverb, and loudness state.

## E. S02+ continuation and color-card extraction

- Inspect the continuation clip before the current segment.
- Identify the final stable 1-2 seconds; exclude flashes or transitions that do not continue.
- Extract and lock: white balance/tint, exposure, face brightness, skin warmth and saturation, shadow hue, black level, contrast, midtone lift, practical-light hue, highlight roll-off, short-drama white diffusion, bloom, microcontrast, haze, grain, and sharpness.
- Confirm this clip-derived state is the highest priority over a separate color card or generic style wording.
- Confirm both prompts use the same extracted state.
- Confirm the Kling prompt includes the mandatory `衔接色卡绑定` line.
- Confirm both require zero visible color or beauty-filter jump at 00:00 and no grade reset across same-scene cuts.

## F. Short-drama white soft-light

- Confirm facial exposure remains bright and readable without clipping.
- Confirm eye catchlights, soft shadow transitions, gentle highlights, and natural pores remain.
- Confirm no waxy skin, global milk haze, excessive bloom, or inconsistent smoothing.
- For S02+, confirm the inherited diffusion, bloom, skin smoothing, face brightness, and microcontrast are preserved rather than replaced by a generic beauty look.

## G. Scene helper assets when required

- If the user requested scene/background consistency, confirm a full-scene video was available.
- Confirm a `场景资产图提示词` block is produced.
- Confirm the scene asset map prompt requires a high-angle top-down complete space view.
- Confirm it clearly asks for all entrances and exits to be labeled.
- Confirm major fixed props and key functional zones are covered.
- Confirm a `主要人物站位图提示词` block is produced.
- Confirm the blocking map prompt uses the same space and marks principal names, positions, facing, and movement paths.
- Confirm both video prompts list `场景资产图1` and `站位图1` only when those assets are actually available.

## H. Camera

- Confirm shared camera intent exists for every shot: size, angle, axis, path, speed, focus, and stop state.
- Confirm Seedance uses coherent technical targets only where they improve fidelity.
- Confirm Kling uses only visually meaningful camera wording and does not contain a data-sheet dump.
- Confirm no unplanned lens, exposure, support, or movement change.

## I. Cross-model factual parity

Confirm both prompts have identical:
- shot count and order;
- time ranges;
- character mapping;
- action start, process, and end state;
- dialogue lines, speakers, and timing;
- props and scene geometry;
- transitions and sound events;
- clip-derived color state;
- final frame, motion, and audio state.

Only prompt expression may differ.

## J. Seedance format

Confirm:
- no `【目标模型】` line appears;
- no `【执行校验码】` line appears;
- one `角色与资产绑定` line exists;
- role/image binding appears once only;
- scene asset map and blocking map are listed only when actually available;
- one compact `短剧白柔光与色卡` line exists;
- one compact `Prompt：` block exists with all shots;
- a `对白英语化` line exists only when dialogue exists;
- a compact `要求：` line exists.

## K. Kling format and pollution gate

Confirm:
- target label is `【Kling VIDEO 3.0 Omni版本｜Kling O3】`;
- no `【目标模型】` line appears;
- no `【执行校验码】` line appears;
- one `主体与资产绑定` line exists;
- every principal role is mapped to one exact user-confirmed subject element;
- reference source and voice-bound state are present;
- subject binding appears once only;
- scene asset map and blocking map are listed only when actually available;
- `衔接色卡绑定` line exists, and for S02+ explicitly makes the continuation clip the highest-priority grade reference;
- exact N `Shot` entries exist inside one compact `Prompt：` line or block;
- each shot has one clear composition, action path, and camera path;
- each dialogue line appears once and only once in the relevant shot;
- no Seedance checksums, full technical parameter dump, fake weights, API switches, alternatives, contradictions, duplicated dialogue, or long generic negative lists remain.

## L. Response format

The final response must contain:
1. One project-location line.
2. `【场景资产图提示词】` and one fenced `text` block when required.
3. `【主要人物站位图提示词】` and one fenced `text` block when required.
4. `【Seedance 2.0版本】` and one fenced `text` block.
5. `【Kling VIDEO 3.0 Omni版本｜Kling O3】` and one fenced `text` block.
6. No other prose.

## M. Forbidden internal-analysis wording

Reject either video prompt if it contains wording such as:
- 反推视频
- 原视频
- 源视频
- 当前段视频
- 内部分析
- 不会提供给模型
- 参考原片
- 根据原视频
- 保持原视频
- 模型无法读取原视频
