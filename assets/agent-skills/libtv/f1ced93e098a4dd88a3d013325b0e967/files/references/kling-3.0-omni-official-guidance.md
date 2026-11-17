# Kling VIDEO 3.0 Omni Prompt Guidance

## Model naming

Use the target label `Kling VIDEO 3.0 Omni`.

Treat `Kling O3`, `KlingO3`, and `可灵O3` as user aliases. Do not present `O3` as the official product name.

## Prompt mode

For strict short-drama reconstruction, use concise Custom Multi-Shot natural language:

1. One global visual and continuity anchor.
2. One user-confirmed principal-subject binding block with exact element names and voice states.
3. Bound character and reference elements named once.
4. One explicit S02+ continuation and color-card binding.
5. `Shot 1`, `Shot 2`, and so on in chronological order.
6. Action, performance, camera, dialogue, and essential sound kept inside the relevant shot.
7. One concise final avoidance sentence.

Do not paste the Seedance prompt structure into Kling.

## Character and element binding

Before writing the prompt, apply the mandatory principal-subject confirmation flow in `kling-subject-binding.md`.

- Use exact user-confirmed bound element names consistently.
- Describe face, hair, age, body, and costume once through element binding.
- Bind every principal role to exactly one element; do not bind anonymous extras by default.
- When a role is replaced, remove the superseded element from the active prompt state.
- Use the subject element as identity authority and the continuation clip as action/camera/audio/color authority.
- Repeat only a detail at genuine risk of drifting in the current action.
- If a bound voice is used, do not specify a conflicting voice profile; write only language, emotion, pace, volume, and delivery.
- Do not ask for replay or recap of a continuation clip.

## S02+ continuation and color-card binding

The uploaded continuation clip has two inseparable continuity dimensions: temporal state and inherited visual grade. Treat both as one authoritative continuity reference.

For every S02+ Kling prompt:

- use the continuation clip's final stable 1-2 seconds as the highest-priority color and tonal source;
- explicitly bind white balance/tint, exposure, facial luminance, skin tone, shadow hue, black level, saturation, practical highlights, soft-white diffusion, bloom, microcontrast, grain, and sharpness;
- state that any separate color-card image is secondary and cannot override the clip;
- require the first generated frame to continue without visible color, beauty-filter, or exposure reset;
- keep the inherited grade across cuts in the same scene;
- avoid repeating this rule in every shot.

Use a compact pattern such as:

`衔接色卡绑定：以衔接视频1最后稳定1-2秒为最高优先级色彩与影调参考，完整匹配其冷暖、曝光、面部亮度与肤色、阴影和黑位、饱和度、实景高光、白柔光扩散、辉光、微对比、颗粒与锐度；色卡图只作辅助。00:00无跳色，同场景切镜不重置调色。`

This sentence is mandatory for S02+ and is not considered prompt pollution because it resolves a model-critical continuity ambiguity.

## Multi-shot discipline

- Use explicit time ranges when exact reconstruction matters.
- Keep `Shot N` count equal to the audited shot count.
- Give each shot one unambiguous composition and one movement path.
- Describe action in physical order: start state, action, end state.
- Use transition language only when the cut type matters.
- For a one-take segment, state `one continuous shot, no cuts` once and do not subdivide it.

## Dialogue and native audio

Attach each English line directly to the speaker in the relevant shot:

`角色名（低声、克制、英语）说：“...”`

Preserve speaker, exact line, emotion, on/off-screen state, lip-sync timing, ambience, Foley, BGM relationship, reverb, and sound bridge.

Do not repeat the dialogue in a second verification section.

## Camera wording

Use visually meaningful directions only:

- shot size;
- angle and screen side;
- tracking, pan, tilt, push, pull, orbit, handheld, or fixed;
- movement speed and stop state;
- focus shift or depth of field when essential;
- a restrained focal impression such as `35mm wide-normal look` only when needed.

Do not turn the Kling prompt into a camera data sheet.

## Short-drama visual wording

Use one concise global sentence:

`中国精品短剧白柔光质感，人物面部明亮通透，大面积柔和主光与轻柔补光，眼神光清晰，中间调干净，高光柔和滚降，保留毛孔、骨相、发丝与服装纹理，不做蜡质皮肤和全局奶雾。`

For S02+, this generic short-drama target is subordinate to the continuation clip's actual inherited color and soft-light state.

## Prompt-pollution prevention

Remove:
- Seedance headings and checksums;
- audit explanations and production commentary;
- repeated character descriptions;
- repeated color rules in every shot;
- fake weights, unsupported switches, API-like syntax, or guarantee language;
- full ISO, shutter, sensor, LUT, and color-science dumps;
- alternative actions joined by `or` or `either`;
- contradictory camera directions;
- long generic negative lists;
- duplicated English dialogue;
- internal-analysis wording.

Prefer:
- concrete nouns and verbs;
- one camera move per shot;
- one global clip-derived color binding;
- direct character-action-dialogue linkage;
- one essential avoidance sentence.

## Final quality check

Confirm:
- every principal character has one user-confirmed subject element;
- exact element names, reference sources, and voice-bound states are preserved;
- no superseded subject remains after replacement;
- exact audited shot count;
- no missing or duplicated dialogue;
- consistent element names;
- one clear action and camera path per shot;
- sound attached to the correct shot;
- short-drama white-soft-light look stated once;
- S02+ continuation clip explicitly bound as the primary color reference;
- clip-derived color state overrides conflicting generic style or color-card language;
- no visible grade reset requested at 00:00 or after cuts;
- no Seedance syntax, audit language, avoidable repetition, or contradiction remains.

## Source note

This skill's Kling structure follows the Custom Multi-Shot, Element Reference, subject building, character speaking-reference, and bound-voice guidance in the official Kling VIDEO 3.0 Model User Guide: https://app.klingai.com/cn/quickstart/klingai-video-3-model-user-guide. Treat capabilities and UI availability as subject to product updates.
