# Color Card and Camera Continuity Lock

## 1. Color-source priority

Use this order for every S02+ segment:

1. The final stable 1-2 seconds of the accepted continuation clip.
2. The accepted project color card or an uploaded color-card image, adjusted to match the continuation clip.
3. The textual style target.

The continuation clip is the highest authority for the opening boundary. If a separate color card conflicts with it, preserve the clip's actual white balance, exposure, skin tone, black level, diffusion strength, bloom, saturation, and highlight behavior.

Ignore a brief flash, transition, lightning hit, screen effect, or moving practical light unless that change continues into the new segment.

## 2. Clip-derived color-card construction

Build a compact 6-8 anchor state from the continuation clip's final stable frames:

- `阴影主色` — hue and density.
- `黑位` — neutral or tinted black and retained shadow detail.
- `环境中间调` — dominant wall, sky, room, costume, or atmosphere neutral.
- `肤色锚点` — warmth, saturation, facial luminance, and relation to the background.
- `实景光/高光` — practical-light hue and highlight color.
- `强调色` — costume, prop, blood, signage, or narrative accent.
- `高光滚降` — softness, warmth/coolness, and clipping behavior.
- `白柔光状态` — diffusion strength, bloom radius, facial microcontrast, catchlight size, skin smoothing, and sharpening.

Use approximate HEX values only when visually reliable. Treat them as perceptual anchors, not rendering guarantees.

## 3. S02+ boundary lock

At 00:00, continue the final frame and final grade without a visible reset. Match:

- white balance and tint;
- exposure and facial brightness;
- shadow hue and black density;
- contrast and midtone lift;
- skin warmth, saturation, and whitening strength;
- practical-light hue;
- highlight roll-off;
- diffusion, bloom, halation, haze, grain, sharpness, and texture;
- rain, fog, smoke, dust, or atmospheric density.

The color state must continue through all shots in the same scene unless the timeline explicitly contains a motivated lighting change.

Hard prohibit:
- automatic white-balance drift;
- exposure pumping;
- sudden skin whitening or darkening;
- different beauty-filter strength;
- black-level or gamma changes;
- saturation jumps;
- a new generic LUT replacing the inherited look;
- sudden milk haze, over-bloom, or over-sharpening.

## 4. Kling VIDEO 3.0 Omni color-card binding

For S02+, the Kling prompt must contain one concise `衔接色卡绑定` statement even when the continuation clip is already supplied for continuation.

The statement must:

- identify `衔接视频1` as the highest-priority color and tonal reference;
- specify that the final stable 1-2 seconds determine the new segment's opening and continuous-scene grade;
- summarize the clip-derived anchors: white balance/tint, exposure, skin tone and face brightness, shadow/black level, saturation, practical highlights, soft-white diffusion, bloom, microcontrast, and grain/sharpness;
- state that a separate color-card image is secondary and may not override the clip;
- require no visible color jump at 00:00 and no grade reset after cuts;
- remain concise enough to avoid prompt pollution.

Recommended pattern:

`衔接色卡绑定：以衔接视频1最后稳定1-2秒为最高优先级色彩参考，匹配其冷暖关系、面部亮度与肤色、阴影和黑位、饱和度、实景高光、白柔光扩散、辉光、微对比与颗粒锐度；色卡图仅辅助，不得覆盖衔接画面的实际影调。00:00无跳色，同场景切镜不重置调色。`

When useful, add a single compact anchor line:

`色卡锚点：阴影【...】；黑位【...】；中间调【...】；肤色【...】；高光【...】；强调色【...】；白柔光【...】。`

Do not repeat the same color instruction inside every `Shot N` block. Mention a shot-specific lighting change only when it is visible and narratively motivated.

## 5. Seedance 2.0 color lock

Seedance may use the full color-card and tonal description, including:

- approximate white-balance target and tint;
- exposure and highlight headroom;
- contrast curve and saturation;
- black density and midtone lift;
- skin-tone bias and face-to-background luminance;
- highlight roll-off;
- diffusion, bloom, halation, haze, grain, texture, and sharpness.

For S02+, explicitly state that these targets are derived from the continuation clip and that the clip wins over conflicting generic style language.

## 6. Camera profile construction

Use a stable creative target rather than claiming measured metadata.

Shared camera intent:
- shot size and composition;
- camera height, angle, and screen axis;
- movement path, direction, speed, acceleration, and stop state;
- focus target and depth-of-field behavior;
- restrained focal impression when essential.

Seedance may additionally specify:
- camera/sensor rendering target;
- aspect ratio and frame rate;
- shutter character;
- ISO/exposure index;
- white balance and tint;
- focal length and aperture;
- support or stabilization type.

Kling should retain only visually meaningful camera language. Avoid full ISO, shutter, sensor, LUT, and color-science dumps.

## 7. Continuity rules

- Preserve the same grade, skin treatment, sensor/rendering impression, motion-blur character, and white-soft-light strength through one continuous scene.
- Change focal impression, support, or depth of field only when a cut or visual design requires it.
- Keep skin tone and black level stable through angle changes.
- Keep motion blur coherent with the selected movement.
- At the end of every accepted segment, preserve a stable final 3-5 seconds with original generated audio for the next segment's visual, color, camera, and audio continuity.
