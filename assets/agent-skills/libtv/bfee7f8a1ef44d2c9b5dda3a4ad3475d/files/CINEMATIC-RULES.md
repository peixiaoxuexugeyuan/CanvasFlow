# Cinematic Production Rules — Required Companion

This file is the mandatory continuation of `SKILL.md`. Apply it together with the phase and approval gates in the main file. Do not use it as an independent Skill and do not skip it when no visual reference is supplied.

## Three production modes

### Mode A — First production from script

Use for the demonstration flow:

1. upload or read the script;
2. ask questions and approve the production brief;
3. classify all characters and connected environments;
4. approve the asset manifest;
5. generate all required principal-character three-view sheets and environment anchors;
6. inspect and obtain user approval for the complete setting package;
7. write and approve the detailed text storyboard;
8. generate, inspect and approve the visual storyboard;
9. revise the approved structured, time-coded one-take prompt using the visual storyboard findings; never replace it with a prose summary;
10. obtain “确认生成视频” approval;
11. verify the live Seedance 2.5 schema;
12. create one 30-second video node with synchronized sound;
13. inspect identity, action, spatial continuity, sound and ending.

For one take, declare:

```text
30秒，16:9，严格一镜到底，从第一帧到最后一帧为同一台摄影机连续拍摄；无剪辑、无隐藏剪辑、无全画面遮挡、无黑帧、无白闪、无甩镜拼接、无瞬移。所有换装、换景与片场揭示均在连续可见的摄影机运动中完成。
```

Describe one physical route and time-coded beats. Lead transformations with motivated light and sound, then reveal the new environment through real parallax.

Before video generation, reject the prompt as incomplete if it lacks any of: exact contiguous timecodes; opening and ending frame; character and prop continuity; connected-space topology; actor blocking; camera start/path/end for every beat; motivated exposure changes; directional synchronized sound; believable action duration; or a one-take-specific prohibition block. Do not generate from a single unsegmented paragraph even if that paragraph contains all character and décor details.

### Mode B — Period style and wardrobe video edit

Trigger when the user asks to alter an existing video's location, décor, costume, makeup, lighting or 1920s style.

Before editing, ask:

1. which original video is the source;
2. which scene, costume and identity references control the edit;
3. which performance, timing, camera motion, framing and sound must remain unchanged;
4. whether only appearance changes or spatial structure may also change;
5. whether to preserve original audio.

Then output an edit plan and wait for “确认编辑”.

Use the live Seedance 2.5 `videoEdit2video` capability only after confirming its schema and permitted inputs. Connect exactly one source video plus approved image references within live media limits.

Lock:

- heroine identity and performance timing;
- camera path and duration;
- body motion, floor contact and interaction timing;
- dialogue and sound synchronization unless replacement is requested;
- architectural topology unless structural redesign is explicitly approved.

Change only requested layers. Avoid face replacement, motion drift, costume flicker, new doors, spatial folding and background character duplication.

Keep the original video untouched. Name the result `V2 风格重制版` and create `C1 原版/重制版对比` or position both versions clearly for screen recording.

### Mode C — Route-map-assisted video edit

This is optional and must not activate automatically.

Activate only when the user explicitly asks for route-map assistance, map positioning, controlled blocking, corrected walking direction or travel through specified rooms. Example triggers:

- “要求路线图辅助”;
- “控制女主走位”;
- “根据新地图定位”;
- “人物必须按这条路线跑”;
- “她总是走错方向”;
- “保持房间连接关系”.

Do not activate for ordinary storyboards, ordinary costume edits or general style changes.

#### Route Stage 1 — Ask about environment and desired movement

Ask and wait:

1. Does the route use the source video's environment or new environment references?
2. Which image controls architecture and which controls décor?
3. Where does the heroine start and end?
4. Which doors, corridors, rooms, stairs and landmarks must she pass in order?
5. Where must she turn left, turn right, stop, look back, ascend or enter?
6. Must original motion rhythm, camera path and duration remain unchanged?

If the reference environment cannot physically support the requested path, explain the conflict instead of drawing an impossible map.

#### Route Stage 2 — Confirm text topology

Output a simple topological chain and blocking table before creating any map:

```text
舞厅中央① → 舞台左侧门② → 狭长走廊③ → 尽头左转④ → 左侧卧室⑤
```

For each point state location, body orientation, action, screen direction, camera relationship and time range. Ask the user to confirm or correct the route.

#### Route Stage 3 — Generate map and location keyframes

Only after route confirmation, create `M1 俯视路线图`:

- 16:9 clean orthographic top-down film-blocking plan, never a perspective view;
- pale warm-gray or ivory background, dark charcoal walls, white room interiors and restrained drafting-line texture;
- walls, openings, door leaves and door-swing arcs clearly visible at a consistent scale;
- room names and only essential landmarks in simple legible labels;
- one continuous high-contrast red route line with repeated arrowheads showing travel direction;
- numbered circular points `① ② ③...` matching the approved text topology exactly;
- green `START`, red `END`, and explicit `LEFT`, `RIGHT`, `UP`, `DOWN`, `DOOR` or `STAIRS` cues only where needed;
- a small legend defining route, direction, stop and turn symbols;
- enough empty margin so no label, arrow or route point is cropped;
- no route crossing walls, furniture or closed openings and no skipped threshold;
- structural topology consistent with environment references; if architecture is ambiguous, stop and ask rather than invent a convenient door;
- décor kept schematic and secondary, using only simple furniture footprints needed for orientation;
- no characters, photorealistic textures, cinematic lighting, 3D rendering, isometric view, decorative illustration, fantasy cartography or dense prose.

Treat the route map as production information, not as a beauty image. It should resemble a professional assistant director's blocking plan or architectural floor-plan overlay. If generated text is unreliable, prioritize stable numbers and symbols, then place the full label legend in an adjacent text node instead of regenerating misleading words.

Also create 4–6 `K` location keyframes when the route includes several turns or thresholds:

- start position;
- approach to first door;
- threshold crossing;
- corridor midpoint;
- turn moment;
- destination entry.

Each keyframe must preserve the same heroine, costume, architecture and screen direction.

Show the route map and keyframes and wait for “确认路线编辑”. Do not edit the video before this approval.

#### Route Stage 4 — Run route-constrained edit

After approval:

1. keep the source video unchanged;
2. verify Seedance 2.5 live `videoEdit2video` or `mixed2video` schema;
3. connect the source video, route map, location keyframes and necessary identity/environment references within live limits;
4. identify every media input's role in the prompt;
5. preserve original action rhythm and camera unless the user approved changes;
6. generate `V3 路线定位重制版`;
7. inspect all numbered route moments;
8. regenerate if the heroine crosses walls, reverses direction, misses a door or teleports;
9. create `C2 路线图/定位帧/成片对照` for demonstration.

Treat the map as a topology and blocking guide, not as a texture or visual-style reference. The source video controls temporal rhythm; the map controls route; location keyframes control spatial landing points; identity reference controls the face; environment references control architecture and décor.

## Continuity locks

### Character lock

Record and reuse age, face geometry, eyes, complexion, hair silhouette, body proportions, emotional baseline, costume construction, jewelry, stockings, shoes and carried props. Never replace an approved heroine with a new model.

### Space lock

Record room proportions, architectural axis, camera side, walking direction, door position and opening direction. Every threshold must already exist in the preceding space.

For structure-preserving edits, lock crop, camera height, focal-length impression, vanishing point, walls, windows, doors, stairs and floor boundary. Change only approved surfaces, décor and light.

### Light lock

For every scene record visible source, position, direction, temperature, intensity, falloff, illuminated facial planes, shadow side and transition to the next source.

Use roughly 4:1 contrast for intimate interiors and up to 8:1 for corridors or stages while preserving shadow detail. Do not add directionless beauty light.

Choose one dominant exposure logic for each frame. If daylight enters through a door or window, expose around that source and allow large interior regions to remain one to three stops darker. Practical lamps may create small local pools but must not illuminate every wall equally. Do not use warm wall lamps, window light and invisible frontal fill at the same strength.

For a face near a window or doorway, let the source-side cheek and eye receive soft directional light while the opposite side falls into readable shadow. Avoid symmetrical catchlights, uniform skin brightness, beauty-dish frontal light and glowing skin detached from the room.

## 1920s visual and costume direction

Before designing any character, state a costume brief with **year band, region, social class, occupation, occasion, season, time of day and required movement**. Ask when any of these would materially change the silhouette. Do not use one generic “1920s look” for every role.

Use this period split:

- **1920–23:** longer calf-length hems, softened natural or slightly lowered waist, restrained decoration, postwar daywear and lingering late-1910s structure;
- **1924–27:** straight tubular silhouette, clearly lowered waist, knee-to-mid-calf hems, cloche hats, geometric trims and T-strap or Mary Jane shoes;
- **1928–29:** uneven or slightly longer hems returning, more fluid bias influence, refined Art Deco beadwork and evening handkerchief panels, but still no 1930s waist emphasis or broad-shouldered tailoring.

Differentiate costume by function:

- **job-seeking/daywear:** modest silk or cotton blouse, softly dropped-waist wool or rayon day dress, or a relaxed hip-length jacket with a straight calf-length skirt; practical leather handbag or document envelope; limited jewelry;
- **cinema/office staff:** collared dress or blouse and skirt with apron, badge or ledger where relevant; sturdy low shoes;
- **upper-class afternoon:** silk day dress, lightweight coat, cloche, gloves and refined leather shoes;
- **evening/ballroom:** relaxed dropped-waist column, bateau or modest scoop neck, broad shoulder coverage, georgette or chiffon, geometric beadwork and lightweight layered fringe;
- **working kitchen/service:** washable dress, apron, sleeves secured away from work and practical closed shoes;
- **running action:** secure straps, low stable heel, no loose train, fringe and coat physics compatible with speed.

For the job-seeking heroine in a late-1920s European setting, avoid a cropped structured blazer, strongly natural high waist, broad shoulders and long fitted pencil-like skirt. Prefer a soft dove-gray or muted blue hip-length wool jacket with narrow notched or rounded dark collar, an ivory blouse with small collar, and a straight navy calf-length skirt whose waist reads subtly lowered or visually continuous beneath the jacket. Keep construction relaxed rather than 1930s–40s tailored.

Use day shoes in dark walnut, oxblood or black calfskin: closed softly rounded or almond toe, one narrow T-bar connecting instep and ankle strap, small side buckle, restrained perforation, and a 3–4 cm low inward-curving Louis heel or narrow Cuban heel. Keep the same toe, strap, buckle, heel and color in every view. Reserve champagne satin, metallic brocade, crystal buckles and brighter ornament for evening shoes.

For late-1920s eveningwear, use champagne silk georgette, silver bugle beads, pale-gold seed beads, clear crystals, chevrons, stepped fans and layered fringe below the low waist. Add warm beige seamed stockings, champagne T-strap dance shoes, finger waves and a refined geometric diamond bandeau.

Use original combinations of Beaux-Arts, Georgian or Gothic Revival architecture with Art Deco furnishings. Favor ivory plaster, dark walnut, antique brass, crystal, black lacquer, burgundy velvet, patterned carpet, champagne highlights, warm silver and cool blue-green night separation. Use fine 35 mm grain, mild halation, soft highlight roll-off and natural skin texture. Luxury comes from scale, material, staffing, social density and motivated practical light—not from making everything gold.

### Global cinematic still standard

Prioritize observation over spectacle in every narrative and environment image. Adapt brightness to the story—morning exteriors may be open and airy, while corridors may be substantially underexposed—but always preserve a coherent source-to-shadow relationship.

- use believable camera distance and perspective; default to a natural 35–50 mm impression unless scale, movement or emotion justifies another lens;
- allow windows, doors, chandeliers or stage lamps to become the brightest areas, with controlled bloom and darker surrounding planes;
- keep rooms functional, inhabited and slightly imperfect; do not add chandeliers, sconces, mirrors or gold ornament merely to signal wealth;
- avoid exact bilateral symmetry unless the architecture or dramatic beat requires it; break sterile repetition through real wear, prop logic and restrained variation;
- make every bright facial plane traceable to the established source; do not detach a perfectly lit portrait from a dark environment;
- use generated signage only when narratively necessary; keep it short and verify it visually, otherwise use graphic shapes and add reliable labels outside the image.

For environment anchors, default to an empty or sparsely occupied room. For identity anchors, use the neutral studio three-view format. Do not generate cinematic corridor portraits as identity anchors, and do not place a centered, perfectly lit character into every environment image.

Reject and regenerate when costume mixes periods or social functions: 1930s natural waist and bias glamour, 1940s cropped box jacket and padded shoulders, modern office suit, bodycon shaping, corseted waist, spaghetti straps, strapless gown, miniskirt, stiletto, platform, modern block heel, synthetic glitter sheet, contemporary contouring or plastic skin.

## Cinematography, light and sound

Use 24–28 mm for monumental reveals, 32–40 mm for walking coverage and 50–65 mm for reactions. Use frontal retreat tracking, rear three-quarter following, profile tracking, controlled arcs, physical dolly push-ins and pullbacks.

Maintain the 180-degree axis unless visibly crossed. Avoid indoor drone movement, wall penetration, arbitrary focal jumps and framing resets.

Use restrained performance: eyes react before the head, fingers tighten, breath changes before movement. Avoid exaggerated gasps and fashion posing.

Motivate all light:

- entrances: cool daylight and warm interior practicals;
- waiting rooms: window side light plus sconces;
- stages: visible top or three-quarter spotlight and dim house practicals;
- ballrooms: chandeliers, table lamps and cool night separation;
- corridors: repeated light pools moving across the actor;
- bedrooms: intimate lamp key plus cool window edge;
- studio reveal: work lights, flags and green screen only after `Cut`.

Use period piano, upright bass or tuba, brushed snare, muted trumpet, clarinet or saxophone, violin and natural vocals. Let doors filter music and let acoustics change across thresholds. Keep a director non-diegetic and off-screen unless appearance is approved.

## Video and storyboard inspection gates

Reject and revise if any answer is no:

- Does every storyboard panel depict a story action?
- Is the heroine the same person throughout?
- Are costume, hair, jewelry and props continuous?
- Can actor and camera physically move between spaces?
- Are doors, turns, eyelines and screen direction stable?
- Does every face highlight and shadow have a visible source?
- Does every panel cause the next?
- Are route-map points followed in order when route mode is active?
- Is a requested one take truly free of hidden edits?
- Is dialogue and sound synchronized?
- Are the original and edited outputs both preserved for comparison?
- Does the frame follow the target reference's exposure strategy rather than a generic amber luxury grade?
- Is there one dominant motivated source instead of every practical glowing at equal strength?
- Do materials show believable age, use and tonal variation rather than polished AI perfection?
- Does the image avoid portrait-advertising light, excessive symmetry, synthetic bokeh and over-sharpened skin?

Only after passing inspection report completion.

Append and adapt this anti-AI negative block to **every narrative frame, environment image and visual storyboard prompt**; do not append studio-scene terms to three-view sheets or photorealistic terms to route maps:

```text
AI宣传照，酒店样板间，豪华地产广告，统一金黄色滤镜，满墙灯具全部点亮，所有光源同等亮度，无来源正面补光，对称美颜眼神光，磨皮塑料皮肤，橙色肤色，过度锐化，HDR暗部抬升，假景深，合成感散景，过度整洁，抛光新家具，重复灯具，堆砌金色装饰，错误海报文字，角色正对镜头摆拍，环境人物肖像化。
```

## Screen-recording demonstration layout

When preparing the canvas for a tutorial recording, arrange the workflow left to right:

1. uploaded script and references;
2. Agent analysis and confirmation text;
3. character and environment anchors;
4. written storyboard and visual storyboard;
5. `V1 原始30s一镜到底`;
6. `V2 1920s风格重制版`;
7. optional `M1` route map and `K` location keyframes;
8. optional `V3 路线定位重制版`;
9. original/edited comparison nodes.

Keep relevant conversation and node connections visible. Do not delete the original video or overwrite approved assets; create new versioned nodes so the before/after demonstration remains clear.
