# Seedance 2.0 Official Capability Guidance

Use this reference before generation-prompt delivery or review.

## Officially supported capabilities

- Target model: `doubao-seedance-2-0-260128`.
- Unified multimodal audio-video generation with text, image, audio, and video inputs.
- Supported duration includes the skill's standardized 10-second unit.
- Multimodal references can guide composition, camera language, movement rhythm, subject identity, lighting, sound characteristics, continuation, and editing.
- Text storyboards can control multi-shot sequences, actions, camera movement, sound design, and audiovisual timing.
- Native output can combine BGM, ambience, Foley, effects, dialogue, and stereo spatial relationships.
- Video continuation can be combined with character-image and visual-style references.

## Prompt implications

1. Use an explicit time-coded storyboard as the primary control signal.
2. State the exact shot count and dialogue count to reduce omission or autonomous re-planning.
3. Give each model-facing asset one responsibility.
4. For S02+, continue from the final visual and audio state and prohibit replay or duplication.
5. Add a textual color card and stable tonal description to reduce inter-segment grade drift. When a color-card image is supplied, assign it only to color and texture.
6. Add coherent camera and lens targets per shot when the production requires strict cinematographic continuity. Treat these as creative generation targets, not API controls or measured metadata.
7. Describe native audio inside each shot.
8. Keep production instructions Chinese and only final spoken lines English.
9. Do not mention or explain internal analysis material in the final model prompt.
10. Avoid unsupported API parameters or claims that exact cinematic values are guaranteed; use camera and color values as direction and continuity locks.

## Official sources

- ByteDance Seed model page: https://seed.bytedance.com/zh/seedance2_0
- ByteDance Seed official launch article: https://seed.bytedance.com/blog/seedance-2-0-official-launch
- ByteDance Seed technical report: https://arxiv.org/abs/2604.14148
