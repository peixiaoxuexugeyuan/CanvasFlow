# Prompt recipes

## Contents

1. Prompt order
2. Static keyframe recipe
3. Video recipe
4. 4x4 grid recipe
5. Continuity lock
6. Negative prompts
7. Text and UI handling
8. AE launch pages and lineup endings

## 1. Prompt order

Put objective facts before aesthetics:

`deliverable + identity lock + scene + composition/camera + product state + light/material + action/timing + end frame + copy safe area + continuity + quality constraints + exclusions`

Avoid keyword soup. Use complete, unambiguous clauses and one dominant action per shot.

## 2. Static keyframe recipe

```text
Create one [aspect ratio] premium studio product keyframe.
Product identity: [identity lock].
Frame: [shot size], [camera height/angle], [lens character], [composition and negative space].
Scene: [background mode and palette].
Lighting: [source size, direction, hardness, color, intended material evidence].
Moment: [precise product/component state at this timecode].
Continuity: preserve [orientation, component count, color, label placement, scale family].
Leave clean safe area at [location] for post-produced copy; render no text.
Photoreal product visualization, physically plausible reflections, clean edges, controlled depth of field.
Exclude: [shot-specific negatives].
```

## 3. Video recipe

```text
Generate a [duration]-second [aspect ratio] premium studio product shot at [frame rate/look].
Product identity: [identity lock].
Start frame (0.0s): [exact position, orientation, crop, light state].
Camera: [path, speed curve, lens behavior, focus behavior].
Subject: [independent product/component action and endpoint].
Light: [independent travel path, speed, and material response].
Timeline: [0–Xs action]; [X–Ys action]; [Y–end signature].
End frame: [exact hero or transition state].
Continuity anchor for next shot: [shape/axis/color/luminance/occlusion/sound].
Keep geometry, labels, color, finish, component count, and background stable.
No embedded captions; reserve [safe area] for post-produced copy.
Exclude: [shot-specific negatives].
```

If the model accepts camera language poorly, replace lens numbers with perceptual descriptions such as “neutral telephoto compression” or “controlled probe macro with minimal distortion.”

## 4. 4x4 grid recipe

### Fast contact-sheet mode

```text
Create a single 4x4 cinematic storyboard contact sheet containing exactly 16 equal rectangular cells in left-to-right, top-to-bottom reading order. Every cell shows the exact same [identity lock], with consistent geometry, color, finish, label placement, and component count. Premium minimalist studio product film on [background system]. Use the supplied 16-frame plan exactly: [F01 ... F16 compact descriptions]. Add only small neutral frame numbers 01–16 in the upper-left margin of each cell; no captions, logos, watermarks, or extra panels. Uniform gutters, consistent aspect ratio, production storyboard clarity, no merged cells.
```

Some models cannot reliably create exactly 16 panels or preserve one product. If either count or identity fails, switch to separate-frame mode.

### Production separate-frame mode

1. Generate F01 as the visual anchor from the product reference.
2. Generate F02–F16 individually, repeating the identity lock and the previous/end-state continuity anchor.
3. Keep aspect ratio, color management, background system, lens family, and lighting family fixed.
4. Composite into a 4x4 sheet in post; add numbers and timecodes after generation.

Plan the 16 frames as:

- F01–F04: clue and reveal;
- F05–F10: feature articulation;
- F11–F13: material/variant crescendo;
- F14–F16: full hero, promise, end lockup.

Rebalance by duration and information density when needed.

## 5. Continuity lock

Repeat these fields in every shot prompt:

- silhouette and proportions;
- exact number and location of components;
- finish and base color;
- label/logo placement or explicit absence;
- orientation family and scale range;
- background and light family;
- last-frame state from the previous shot.

When references are available, use them. Do not claim seed or character-reference controls that the active tool does not expose.

## 6. Negative prompts

### Master product lock

`wrong product, altered silhouette, warped geometry, extra or missing components, duplicated buttons/ports/lenses, invented seams, changed color, changed finish, floating label, misspelled text, brand substitution, inconsistent scale, melting edges, asymmetry where product is symmetric, impossible reflections`

### Studio cleanliness

`visible stand, unwanted floor line, clutter, hands, people, room reflections, dust, scratches, fingerprints, smoke, excessive particles, heavy lens flare, chromatic aberration, crushed blacks, clipped highlights, oversaturated teal-orange grade`

Use only relevant negatives. If the product should stand on a surface, do not exclude contact shadows. If hands are needed to prove use, describe casting, gesture, skin, and interaction rather than excluding people.

## 7. Text and UI handling

- Prefer no generated text in source frames.
- Specify safe area, copy content, entrance timing, alignment, and animation separately for post.
- If text generation is mandatory, keep to one short line and verify every character.
- Do not request imitation of Apple typography. Use a licensed neutral grotesk/system sans or the user’s brand font.
- Do not reproduce proprietary iPhone UI unless the user owns/has permission and it is necessary to represent a compatible app accurately.

## 8. AE launch pages and lineup endings

Keep typography, feature chips, model names, prices, selectors, and CTAs out of source image/video generation. Generate a clean product plate with deliberate safe areas, then build verified text and shapes as live AE layers.

For black verdict pages, feature-chip pages, two-tier comparisons, and lineup comprehensive boards, follow `ae-launch-pages-and-endings.md`. Every delivery must include page composition, layer stack, frame/second timing, property keyframes, easing, copy, sound, transition anchor, and the originality-distance result.

For a final comprehensive still, prompt only the card backgrounds and product plates when identity consistency is critical; composite products, text, swatches, prices, and CTA in post. Avoid asking an image model to recreate a supplied commercial webpage.
