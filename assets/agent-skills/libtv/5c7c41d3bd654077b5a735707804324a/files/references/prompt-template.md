# Prompt templates

Use only the clauses supported by the references and the user's direction. Replace bracketed fields; do not leave placeholders in the delivered prompt.

## Production identity-card prompt

```text
Create one standardized multi-panel character identity card of exactly the same [character description] based on the supplied identity-reference images. Preserve the character's observable facial structure: [identity anchors]. Preserve [hair], [complexion], [body silhouette], and [wardrobe]. Do not beautify, idealize, or redesign the person.

Layout: a clean 3:4 portrait contact sheet. Upper left is one large, sharply resolved frontal head-and-shoulders portrait with a neutral expression and direct gaze. Upper right contains three narrow body-turnaround panels in this order: front, side/three-quarter, back. Bottom row contains four equal head-and-shoulders views: left profile, left three-quarter, front, right three-quarter. Every clear face panel must be recognizably the same person, with identical apparent age, skull shape, eye spacing and eyelid form, nose bridge and tip, lip contour, jawline, ears, hairline, and hair color.

[BODY MODE CLAUSE]

The background is a pure neutral-white seamless studio, clean and uniform, with thin light gutters separating panels; no environment, furniture, props, logos, labels, captions, or watermarks. Use standardized professional studio photography: a large diffused key light slightly off-axis, restrained fill, neutral 5000–5300 K color, soft rectangular catchlights, natural tonal separation, minimal cast shadow, and no dramatic grading.

Render realistic human skin rather than cosmetic perfection: visible but subtle pores with physical depth, natural eyelid folds and under-eye texture, fine peach fuzz under side light, restrained micro-shadowing, slight regional color variation, and natural low-level skin sheen. Keep facial bone structure and skin relief. Use fine organic film grain and optical clarity without digital edge sharpening.

Avoid beauty-filter skin, plastic or wax skin, fake pore noise, excessive makeup, influencer-face homogenization, face drift, age drift, body-proportion drift, garment changes, asymmetrical panel scale, extra fingers, fused limbs, malformed hands or feet, duplicated accessories, CG/game-render appearance, painterly texture, over-HDR, oversharpening, smearing, facial blur, mosaic, or pixelation.
```

Use one of these body-mode clauses:

### Headless body clause

```text
For the front and side/three-quarter body panels only, use a clean editorial crop/mask at the collar and shoulder line so each body asset runs from shoulders to shoes with white negative space above. No face or head pixels appear in these two panels. For the back body panel, do not apply the headless crop: show one true 180-degree rear view of the complete person from the crown/back of the head to the shoes. Clearly preserve the back-of-head silhouette and rear hairstyle—hair volume, direction, length, taper, and nape shape—consistent with the identity reference. The rear head faces directly away from camera; show no eyes, nose, mouth, cheek, or readable side-face profile. Do not crop, erase, blank, blur, mosaic, pixelate, or smear the rear head, and do not create a severed-neck effect. The separate close-up face panels remain the sole facial-identity source.
```

### Full-head body clause

```text
For all three body panels, show the complete person from head to shoes. Distant faces remain the same identity as the large frontal portrait, without simplification, distortion, blur, or substitution.
```

## Compact prompt for point-consuming tools

```text
同一角色身份卡，严格参考输入人物。3:4白底摄影棚拼版：左上大幅正脸半身；右上正面、侧面、背面身体；下排左侧脸、左45°、正脸、右45°。锁定脸型、眼距眼形、鼻唇、下颌、耳朵、发际线、发型、年龄、肤色、身材比例和服装。自然真实皮肤纹理，柔和中性棚拍光，禁止美颜、塑料皮、变脸、变年龄、服装漂移、肢体错误、文字水印。[精简身体模式要求]
```

For headless mode, replace the final placeholder with:

```text
正面与侧面/侧前方身体视图从衣领肩线到鞋完整展示，头部区域干净留白；背面必须为严格180°完整后视，从后脑勺发顶到鞋全部入镜，保留与参考一致的后脑勺轮廓、发量走向、长度、收尾和后颈发际线。背面不露眼鼻口、脸颊或可辨识侧脸；不得裁掉、抹除、留白、模糊或马赛克处理后脑勺，不出现断颈。
```

For full-head mode, replace it with:

```text
身体三视图完整显示头到脚，远景脸仍须与主正脸完全同一身份。
```

## Identity lock syntax

Describe observable geometry and relationships instead of aesthetic rankings. Prefer:

```text
[apparent age range]; [face length-to-width impression]; [jaw/chin geometry]; [eye spacing and eyelid form]; [brow direction]; [nose bridge/tip/alar relationship]; [lip contour and volume]; [ear placement]; [hairline and hair silhouette]; [stable asymmetries or marks].
```

Avoid unsupported ethnicity, personality, class, health, or attractiveness claims. If a requested body or rear view is not visible in any source, state that it is designed from the user's instruction rather than recovered from the reference.