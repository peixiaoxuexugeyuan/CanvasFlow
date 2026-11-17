# Complex Shot Directing and Prompting

A complex shot is not a list of camera moves. It is one legible dramatic event coordinated across subject,
camera, light, environment, focus, transition and sound.

If the project has no approved style, first route it with `default-quality-routing.md`. The route determines
which evidence the move must reveal: vehicle volume and stance, phone-scale construction, motif transformation,
body relation, or directional performance. It does not automatically make the camera more complex.

## 1. Complexity gate

For each beat allow, by default:

- One primary subject event.
- One primary camera intention.
- One visible state change.
- One VO/dialogue or designed-SFX anchor.

A secondary environmental reaction is allowed if it follows from the primary event. If several independent
events compete, split the shot, use staged generations, or plan a post/VFX composite.

## 2. Spatial topology before prose

Record:

- Subject start/end positions, orientation, eyeline and travel axis.
- Camera start/end position relative to the subject, height and viewing axis.
- Foreground occluders and reveal points.
- Middle-ground action and hero readability zone.
- Background geography, exits and continuity landmarks.
- Light direction and reflective surfaces.
- The spatial bridge into the next shot.

If the path cannot be sketched as a simple map, the model prompt is not ready.

## 3. Camera path contract

Describe the camera with:

`motivation → starting pose → target/subject relationship → path and axes → distance/height/orientation change →
speed curve and inertia → focus/exposure response → stopping frame`

Do not write “mechanical-arm shot”, “cinematic orbit” or “dynamic drone move” as the main instruction.
Translate them into a reproducible path. An orbit is justified only when changing angle reveals volume,
relationship or threat; otherwise it is decoration and increases identity drift.

## 4. Subject choreography contract

Describe:

`start state → trigger → action phases → weight/resistance → contact/environment response → end/handoff state`

For products, protect topology, logo orientation, hinge/part count and functional motion. For people, track
weight transfer, hands, gaze and breathing. For vehicles, track wheel direction, body roll, road axis and reflections.

## 5. Build, breathe, resolve

- **Build:** establish geography, visual rule, direction and cause.
- **Breathe:** sustain the main action long enough for performance or product evidence to be read.
- **Resolve:** land camera, action, focus, light and sound into an end state or transition bridge.

Record the establishment point, readable window and landing frame. Time percentages are project-specific.

## 6. Parallax, occlusion and focus

Complex movement becomes legible through layers:

- Foreground produces speed, concealment and transition wipes.
- Middle ground protects identity, performance and product evidence.
- Background proves geography and creates slower parallax.

Specify which layer moves, which remains stable and where focus transfers. Avoid uniform blur or simultaneous
independent movement in all layers.

## 7. Shared event anchors

Coordinate at least two, and for hero beats preferably three or four:

- Subject anchor: touch, open, strike, turn, lock, land.
- Camera anchor: accelerate, decelerate, reverse, stop, cross axis.
- Light anchor: highlight arrives, practical ignites, shadow crosses, exposure releases.
- Transition anchor: occlusion peak, shape match, flash peak, movement completion.
- Sound anchor: beat, whoosh, impact, click, breath or deliberate silence.

The camera should respond to the event, not perform beside it.

## 8. Time-phased prompt

Use phases based on causal events rather than equal seconds:

1. Starting composition and stable invariants.
2. Trigger and initial response.
3. Main movement and readable evidence window.
4. Deceleration/landing and transition handoff.

Attach approximate time or frames only after the action is designed. Duration is capacity, not permission to
add more events.

## 9. Reference-role contract

For each image/video/audio reference state:

- Primary responsibility.
- Optional secondary responsibility.
- Elements explicitly not inherited.
- Priority when references conflict.
- Shot phase where it applies.

Examples: product image locks geometry and CMF but not lighting; motion reference supplies path and speed curve
but not actor identity or set; audio supplies beat anchors but not edit order.

## 10. Complex-shot prompt order

`shot purpose → invariants → starting spatial state → subject event → camera path → focus/exposure/light response →
environment and material reaction → phase timing → landing frame/transition → sound anchors → negative constraints →
acceptance checks`

Place identity, topology and causal constraints before style flourishes.

## 11. Failure and fallback ladder

If a complex shot fails:

1. Remove competing secondary actions.
2. Lock start/end frames or strengthen identity references.
3. Reduce camera axes or speed changes.
4. Split at an occlusion, action peak or stable landing frame.
5. Generate subject, environment or effect as separate layers.
6. Finish the illusion through edit, VFX, sound and color.

Do not keep lengthening the same overloaded prompt.

## 12. Category-specific complex-shot checks

- **Automotive:** preserve wheel/road axis, body mass, lamp and logo orientation; make reflections travel
  continuously over named panels; land on a readable stance or full-vehicle relationship.
- **Smartphone:** preserve edge radius, port/button/lens count and glass/metal planes; reveal one construction
  claim at a time; avoid accelerating rotation and traveling light simultaneously unless staged.
- **Metaphoric:** keep one motif and causal transformation readable across scale; use gesture/light/edit anchors
  rather than adding camera axes.
- **Chromatic intimacy:** protect body separation, hands/profiles and maximum overlap; let blocking and exposure
  carry intensity before adding camera motion.
- **Graphic kinetic:** lock identity/product geometry during anchor frames; bound distortion, repetition,
  inversion and flash phases; include a stable recovery and accessibility review.
