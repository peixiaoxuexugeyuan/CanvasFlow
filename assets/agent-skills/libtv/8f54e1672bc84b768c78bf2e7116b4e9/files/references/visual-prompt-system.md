# Visual and Motion Prompt System

> Status: v0.1 model-agnostic baseline. Add model adapters only after their behaviour is tested.

For premium look development also load `premium-look-system.md`. For complex camera/action/effect shots
also load `complex-shot-prompting.md`; those modules override generic style-word and move-name shortcuts.
Load `causal-visual-direction.md` for observable aesthetic translation, readability/look passes and
single-layer diagnosis when a generated result fails.
Load `commercial-dramaturgy-and-board.md` when prompts must preserve product causality, feature-bearing
behaviour, scenario proof, claim scope or treatment-to-shot traceability.

## Prompt stack

Build prompts in four layers:

1. **Project bible** — brand world, format, realism level, palette, contrast, texture, lens family,
   camera rules and prohibited traits.
2. **Sequence state** — location, time, weather, characters, wardrobe, product state, screen direction
   and emotional state shared by adjacent shots.
3. **Shot design** — subject/action, composition, viewpoint, lens, camera, lighting, materials and depth.
4. **Motion plan** — start frame, blocking, camera path, timing phases, physics, end frame and edit handles.

Repeat only the invariants required by the target model. Keep the full authoritative state in the shot
record even when a shortened prompt is used for generation.

## Image prompt order

Use this semantic order unless the model requires another syntax:

`shot purpose → subject and visible action → environment → composition and viewpoint → lens/depth →
lighting → palette and contrast → materials/atmosphere → realism and finishing → continuity invariants`

Avoid adjective piles. Translate “premium”, “cinematic” or “luxury” into visible evidence such as
controlled specular roll-off, restrained palette, deliberate negative space, motivated practical light,
fine material separation and consistent optical behaviour.

When revising a failed generation, record the expected result, actual deviation, suspected causal layer,
one-variable change and predicted visual evidence. Do not grow a global negative wall across unrelated layers.

## Motion prompt order

`starting state → subject blocking → camera motivation/path → phase timing → environmental motion →
focus/exposure behaviour → ending state → transition handles → invariants`

Define movement with direction, distance/scale, speed curve and stopping condition. “Camera moves
cinematically” is invalid.

## Look description dimensions

Describe the image across these axes:

- Tonal key and contrast curve.
- Key/fill ratio and shadow openness.
- Source size, direction, hardness and falloff.
- Color temperature relationship and palette hierarchy.
- Saturation distribution, not only global saturation.
- Highlight roll-off, black floor and local contrast.
- Surface response: diffuse, gloss, metal, glass, skin, fabric, particulate atmosphere.
- Optical character: perspective, depth, flare, halation, bloom, grain and edge behaviour.
- Production texture: pristine, tactile, weathered, documentary, heightened or surreal.

## Negative constraints

Use negatives for known recurring failures: identity drift, extra limbs, warped logos, incorrect product
geometry, texture flicker, lighting discontinuity, floating objects, impossible reflections, random text,
camera jitter or unmotivated morphing. Do not use a generic wall of negatives that competes with the shot.

## Reference handling

- Record what each reference controls: composition, lighting, palette, performance, motion, texture or edit.
- Extract observable traits; do not assume a name alone will reproduce a look.
- When references conflict, assign priority and scope instead of averaging them.
- Treat client-provided references as direction, not proof of reproduction rights.

## Reference-first product identity mode

Use this mode when approved images clearly show the target product and the generation tool accepts image
references or edits. The product image owns visible identity; text must not compete with it.

1. **Select before prompting.** Identify the exact target variant. Crop or mask away packaging, hands,
   environments and sibling products when they can pull identity. Prefer the smallest set of views that adds
   real geometric information; do not upload redundant or contradictory references by default.
2. **Assign image responsibility.** State that the selected images control product identity, proportions,
   part relationships, CMF, surface pattern, wear and visible markings. An approved CAD/spec source overrides
   a photograph only for the dimensions or facts it explicitly proves.
3. **Keep text delta-only.** Text specifies output type, layout, action, viewpoint, light, background and which
   changes are allowed. Do not translate every visible ridge, seam and fastener into prose: this often causes
   the model to synthesize a generic average rather than follow the product.
4. **Correct one locality.** If a generation drifts, name only the first mismatching region and the expected
   evidence, then retry with that minimal correction. Remove conflicting prose before adding negatives.
5. **Respect evidence limits.** A new angle inferred from one or two photographs is a visualization, not an
   engineering-accurate orthographic view. For exact three-view, dimensional, fit or manufacturing output,
   request suitable multi-view capture, CAD, photogrammetry/scan or measurements and label any inference.

Minimal model-facing pattern:

`Use the selected product images as the authoritative identity source → create [output/shot] → preserve the
same product across views/frames → specify only composition, camera, light, environment and allowed changes →
keep unclear or unseen detail neutral rather than inventing it`

Do not confuse a short generator prompt with an incomplete director record. Reference roles, crop provenance,
uncertainty and QA remain fully documented outside the prompt.

## Prompt package deliverable

For every shot provide:

- Shot ID and version.
- Target model/tool and mode, if known.
- Input references and their roles.
- Global/sequence invariants.
- Image/keyframe prompt.
- Motion/video prompt.
- Negative constraints.
- Expected start/end frames and duration.
- Acceptance checks and known risks.

For product-led work also retain in the director record: causal role, claim/evidence ID, proof window and
changed state. Translate only approved visible events into generator input. Do not replace image/motion
prompts with strategic analysis; the upstream causal record must make the final prompts more specific.

## Director record versus generator input

The director record retains source anchors, shot purpose, timing clocks, continuity state, batch signature,
approvals and QA. The generator input contains only the tested fields needed by the selected model. Never
delete the director record merely because the model-facing prompt should be concise.

Do not assume that a named camera, lens or film stock will reproduce its physical behaviour. Express
perspective, distortion, depth, flare, highlight roll-off, sharpness, grain and motion behaviour explicitly;
include equipment names only when the user requests them or a tested adapter demonstrates value.
