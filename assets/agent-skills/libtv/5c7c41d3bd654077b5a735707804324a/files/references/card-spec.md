# Character identity card specification

Use this reference only when generating a multi-panel character card.

## Default portrait layout

Use a clean 3:4 portrait canvas with thin white or very light-gray gutters.

- **Upper-left, large panel (about 42% width):** clear frontal head-and-shoulders identity anchor, neutral expression, direct gaze.
- **Upper-right, three narrow panels:** front body, side or three-quarter body, and back body.
- **Bottom row, four equal panels:** left profile, left three-quarter, frontal head-and-shoulders, and right three-quarter.

All panels use the same wardrobe, grooming, apparent age, skin tone, and studio-lighting logic. Default to no labels because generated typography introduces noise; add labels only when requested.

## Headless distant-body mode

This is the recommended mode when the sheet will feed distant AI-video shots.

- The front and side/three-quarter body views show the complete garment and body from the collar/shoulder line to the shoes.
- In those two views, the frame or editorial mask ends cleanly at the collar line; white negative space occupies the area where a head would otherwise appear.
- The back body view is the required exception: show the complete rear figure from the crown/back of the head to the shoes. Preserve the back-of-head shape, rear hair volume, direction, length, taper, and nape silhouette consistent with the identity anchor.
- The back body view must be a true 180-degree rear view. No eyes, nose, mouth, cheek, or readable side-face profile may be visible; ears may appear only as naturally limited by the hairstyle and exact rear angle.
- Never crop, erase, mask, or leave blank the head in the back body view.
- Never use face blur, mosaic, pixelation, smearing, an empty oval, or a visibly severed neck.
- Do not try to preserve facial identity in the small front or side/three-quarter body panels. The separate high-resolution face panels are the only face source for downstream composition.
- If no reference shows the rear hairstyle, use the most conservative anatomical continuation of the visible hair silhouette and report it as inferred. Do not invent a different cut, length, part, accessory, or decorative styling.

## Full-head mode

Use only when requested. Keep the face visible in all body panels, but treat the large face anchor and bottom-row face views as the authoritative identity references. Reject an output if distant faces visibly become a different person.

## Studio and capture standard

- Pure neutral-white seamless background, uniform and texture-free.
- Soft global studio light, neutral approximately 5000–5300 K; a large diffused key slightly off-axis and restrained fill.
- Soft rectangular catchlights in clear face panels.
- Minimal cast shadow and no dramatic rim light.
- Natural perspective: portrait-style focal length for face panels and low-distortion catalog perspective for body panels.
- Neutral stance, relaxed shoulders, arms naturally lowered, hands and feet anatomically correct.

## Identity validation checklist

Reject or revise when any of these occur:

- eye spacing, eyelid shape, nose bridge/tip, lip contour, jaw width, ear placement, hairline, or apparent age changes between face panels;
- garment lapels, buttons, tie, skirt/trouser cut, hem length, socks, shoes, or accessories change between body views;
- body height impression or torso-to-leg ratio changes;
- front or side/three-quarter body panels contain head or face pixels in `headless-body` mode;
- the back body panel in `headless-body` mode omits or crops the head, fails to show the rear hairstyle, turns away from a true rear view, or reveals facial features/side profile;
- skin is waxy, over-smoothed, over-sharpened, or covered by synthetic pore noise;
- extra fingers, fused limbs, duplicated accessories, text, logos, props, or background scenery appear.

Do not reject harmless changes in perspective, natural lighting falloff, or tiny strand-level hair variation.