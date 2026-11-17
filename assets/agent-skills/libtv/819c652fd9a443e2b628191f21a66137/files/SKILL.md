---

## name: black-ink-action-style description: Create or adapt images in a dramatic monochrome ink-and-brush action illustration style, with expressive manga-like faces, sweeping motion, and high-contrast chiaroscuro.

# Black Ink Action Illustration

Use this style when the user wants a dramatic black-and-white action illustration or wants to transfer the visual treatment of the supplied reference to a different subject. Preserve the requested subject, action, setting, and composition; the reference defines the rendering style, not the identity or exact layout unless the user asks for those too.

## Visual language

- Render as a cinematic 2D ink illustration with the force of an action-manga or hand-painted animation frame. Keep the image visibly drawn and brush-worked rather than photographic or 3D.
- Restrict the palette to black, white, and a small range of charcoal grays. Build the image from bold dark masses and crisp white highlights, with strong directional light and deep shadow.
- Use expressive, variable-weight contours, dry-brush edges, broken strokes, scratchy accents, and selective white brush highlights. Let some edges dissolve into smoke, hair, or shadow instead of outlining everything evenly.
- Shape faces with clear graphic planes: sharp brows and eyes, deliberate nose and jaw shadows, and a readable expression. Keep the face as a strong focal point when the framing includes it.
- Treat hair, cloth, smoke, debris, and action marks as directional shapes. Use sweeping strands, diagonal brush streaks, speed lines, or sparse silhouettes to carry motion without obscuring the subject.
- Suggest armor or other hard materials with angular layered forms and a few bright edge highlights. Avoid realistic metallic rendering and excessive tiny detail.
- Use a loose atmospheric background—smoke, ink wash, speed strokes, or negative space—so the silhouette and face remain legible. Add paper grain or ink texture lightly.
- Compose for a clear focal hierarchy and energetic diagonals. The reference often uses a close head-and-shoulders crop, a face toward the left, hair moving across the frame, and armor in the foreground; treat those as optional compositional cues, not mandatory subject constraints.

## Prompt construction

For each request, preserve the user's concrete content first, then add the style language. Name the subject, action, camera distance or angle, setting, expression, and any important props. If the user supplies a style reference, say to borrow its monochrome ink treatment, contrast, and brush texture while following the requested subject and composition.

Prefer specific visible traits over a pile of style labels. Avoid relying on any particular artist, franchise, or proprietary model name. For tools with a negative-prompt field, use the exclusions in `PROMPT-GUIDE.md`; otherwise append a short natural-language exclusion clause.

If the target generator accepts only a short prompt, retain these priorities: monochrome, hand-painted ink, strong black-white contrast, directional brush motion, readable face/silhouette, and requested scene. Do not force armor, long hair, smoke, or a close-up when the user asks for something else.

See [PROMPT-GUIDE.md](PROMPT-GUIDE.md) for copy-ready Chinese and English templates and a negative prompt.