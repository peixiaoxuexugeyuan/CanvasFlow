# Cinematic Short Film Production

## Core Methodology

### Layered Asset Development Framework

Every cinematic project operates through isolated asset layers that must be locked before dependent layers begin:

- **Layer 1 (Style Anchor)**: Moodboard establishing color palette, lighting signature, composition rules — NEVER changes once confirmed
- **Layer 2 (Character Models)**: Model cards (white background, 3-view + close-up) locking facial structure, body proportions, base costume — separate versions for different time periods if story requires
- **Layer 3 (Scene Environments)**: Location anchor images with cinematic lighting (avoid flat AI-generated look) — must reference real photography for authenticity
- **Layer 4 (Shot Breakdown)**: Frame-by-frame storyboard with specific blocking, camera movement, emotional beats
- **Layer 5 (Video Execution)**: Generated video segments with character/scene references applied

Each layer requires explicit user confirmation before proceeding. Never auto-advance through layers.

### Emotion-Weight Time Allocation

Shot duration must match emotional intensity, not mechanical averaging:

- **Opening/Closing**: 5-8 seconds — brief, focused, leave space for audience interpretation
- **Transition Sequences**: 8-10 seconds — convey necessary information efficiently, avoid dragging
- **Emotional Peaks**: 13-15 seconds (maximum per video segment) — allow breathing room for character interactions, eye contact, hesitation
- **Climactic Moments**: Deliberately brief (8-10 seconds) — restraint creates power, especially in separation/farewell scenes
- **Montage Sequences**: Rapid cuts (multiple mini-shots within 10-12 seconds) — build energy through pacing

Total film length emerges from story needs, not pre-set quotas. If initial estimate was 60 seconds but story requires 80-90 seconds to breathe properly, accept the expansion.

### Causality Chain Validation

Every scene transition must have clear logical motivation:

- **Action → Consequence**: Character misses train → checks schedule → discovers long wait → notices café → enters (5-link chain)
- **Environment → Behavior**: Café is crowded → only one empty seat at protagonist's table → stranger must ask to share (justified interaction)
- **Props → Memory**: Character finds old ticket → visual blur transition → flashback begins (tangible trigger)

When user flags "this doesn't make sense," trace back through causality chain to find missing link. Most logic holes occur in scene transitions where motivation wasn't explicitly shown.

### Cinematographic Authenticity Standards

**Light Ratio Control** (critical for avoiding over-processed AI look):

- Backlight can be strong, but MUST have fill light ensuring facial features remain readable
- Never let key subject become pure silhouette unless intentional compositional choice
- Specify light angle explicitly: "soft backlight through window, 3/4 fill from camera left, face clearly visible"

**Blocking Specificity**:

- Avoid static framing: "character stands looking at camera" → "character walks from mid-ground toward camera, pauses at foreground mark, turns to look right"
- Every shot needs subject movement or camera movement (pan, dolly, rack focus)
- Wide shots require environmental storytelling (wind moving curtains, passing vehicles, background pedestrians)

**Reference Integration**:

- When user provides real photography, extract specific elements: lens compression, foreground blur depth, color temperature, weather conditions
- State what you're borrowing: "using reference image's telephoto compression and overcast softbox lighting"

## Workflow

### 1. Foundation Stage

**Input Requirements Checklist**:

- Film duration target (30-60 seconds, 60-90 seconds, etc.)
- Aspect ratio (4:3 classic cinematic, 16:9 standard, 9:16 vertical)
- Language (dialogue language + subtitle requirements)
- Approval mode (auto-proceed vs manual confirmation at each milestone)
- Story seed (theme, mood, character relationship, key event)

**Style Anchor Generation**:

- Create moodboard combining representative scene elements (location type + lighting + color mood)
- If user references specific aesthetic (e.g., "Shunji Iwai" style): define visual signatures in prompt (strong backlight, halation glow, cool silver tones, shallow depth of field)
- Generate ONE moodboard image, lock as style reference for all subsequent assets
- Explicitly state visual rules extracted from moodboard: color saturation range, light direction preferences, composition patterns

**Story Structure Design**:

- Present structure options: linear, circular (ending echoes beginning), fragmented montage
- If user feedback is "story feels flat," diagnose through structure analysis:
  - Missing emotional peaks? → Add character interaction beat
  - Too rushed? → Redistribute time to key moments
  - Unclear motivation? → Insert causality bridge scene
- Write complete story outline with beat-by-beat breakdown before proceeding

### 2. Character Asset Stage

**Initial Candidate Generation**:

- If user uploads reference faces: extract ONLY facial structure direction (face shape, eye spacing, overall vibe), NEVER replicate identifiable real individuals
- Generate 2x2 grid comparison image (4 styling variations per character) for user selection
- Each variation should test one dimension: different hairstyles, different outfit styles, different angles
- Present as single composite image, not 4 separate images

**Iterative Refinement Rules**:

- ONE variable per iteration: if changing costume, keep face/hair locked
- If user says "looks wrong," ask which specific element (face shape, outfit, hair, expression)
- Never cascade multiple candidate generations without confirmation — generates decision fatigue

**Model Card Finalization**:

- White background studio format: front view, 3/4 view, side view, facial close-up
- Lock model card before ANY shot generation begins
- If story spans multiple time periods (e.g., "years later"), create separate model card variant with aged styling (mature clothing, different hairstyle, accessories like glasses), but SAME facial structure

### 3. Environment Asset Stage

**Scene Anchor Generation**:

- Identify ALL unique locations story requires (train station, café, beach walkway, shrine, etc.)
- For each location, generate anchor image in target aspect ratio with cinematic lighting
- If user flags "too AI-generated," add specificity:
  - Real architectural detail references
  - Practical light sources (visible lamps, window direction)
  - Environmental storytelling (weathering, usage signs, lived-in details)
  - Foreground depth elements (tree branches, railings, out-of-focus objects)

**Authenticity Enhancement**:

- When user provides real location photos, analyze what makes them feel real:
  - Imperfect geometry (walls not perfectly parallel)
  - Natural wear patterns
  - Ambient occlusion in corners
  - Believable light bounce
- State these elements explicitly in generation prompt

### 4. Shot Breakdown Stage

**Storyboard Design Principles**:

- Each story beat = 1 video segment (max 15 seconds per segment)
- Video segments can contain 2-3 mini-shots via hard cuts (action continuity within segment)
- Number shots by emotional weight, not mechanical division:
  - Example: 8 story beats might become 6 video segments (some beats merged, peak moments get full segment)

**Blocking Documentation Format** (per shot):

```
Shot [Number] | [Location] | [Duration]s

Setup:
- Camera: [angle/movement, e.g., "eye-level medium shot, slow dolly-in"]
- Lighting: [key light direction + fill + mood, e.g., "backlit by window, soft fill from left, face visible"]
- Characters: [starting positions]

Action Sequence:
1. [Character A specific movement with timing]
2. [Character B reaction detail]
3. [Camera adjustment or cut point]

Dialogue (if any):
- [Character]: "[Japanese line]" / [Translation]

Emotional Beat: [what this shot establishes]
```

**Common Blocking Errors to Avoid**:

- "Character looks at camera" → specify WHERE they look, posture, micro-expression
- "Two people talk" → specify distance between them, who moves, gesture patterns
- "Character walks" → specify path (background to foreground, left to right, etc.), pace, moment of stopping

### 5. Video Generation Stage

**Batch Execution Strategy**:

- Generate in batches of 3-4 segments, confirm each batch before proceeding
- Explicitly reference locked model cards + scene anchors in every generation prompt
- Never reference moodboard directly in video generation (only in asset creation) — use concrete scene + character references instead

**Prompt Construction Formula**:

```
[@image:#1:scene_anchor:URL] [@image:#2:character_model:URL]

[Camera movement]: [specific action]
[Character blocking]: [detailed position/movement path]
[Lighting]: [direction/quality]
[Emotional tone]: [specific mood]
[Dialogue]: [exact Japanese lines with translation]

[Aspect ratio] [Duration]s [Environmental sound notes]
```

**Quality Control Checkpoints**:

- Facial consistency: Compare generated face to model card, if drift occurs, regenerate with stronger character reference weighting
- Logic continuity: Does action flow match storyboard? If character enters right but exits left, validate spatial consistency
- Lighting authenticity: Can you see character's expression? If backlit to silhouette, adjust unless intentional

### 6. Iteration Stage

**User Feedback Categories & Responses**:

- **"Not cinematic enough"**: Diagnose lacking element (lighting drama, camera movement, foreground depth, composition) and regenerate with explicit cinematography direction
- **"Characters look different"**: Model card drift — regenerate with stricter character reference adherence
- **"Scene looks fake"**: Add environmental authenticity cues (practical light sources, real material textures, imperfect geometry)
- **"Story feels empty"**: Insert character interaction beat (montage sequence, intimate dialogue moment, props exchange)
- **"Wrong emotion"**: Review shot duration — rushed peaks need expansion, dragging transitions need compression

**Scene Transition Design**:

- When user flags "transitions feel abrupt," insert bridging elements:
  - Visual detail shots (wind chime ringing, curtain flutter, train ticket close-up)
  - Character reaction beats (pause before decision, glance triggers memory)
  - Environmental mood shifters (light change, weather transition, sound bridge)

**Segment Splicing (Advanced)**:

- If user approves shots 1-3 of video segment but rejects shot 4, generate only replacement shot 4, then splice using video composite tool
- Document timestamp cuts precisely: "Keep 0:00-0:09 of original, insert new ending from 0:09-0:15"

### 7. Post-Production Stage

**Assembly**:

- Concatenate all confirmed video segments in story order
- Generate background music matching emotional arc (if required): rising energy for meet-cute sequences, restraint for farewell moments, ambient for bookend frames
- If adding subtitles, ensure bilingual format if specified (Japanese + user's language)

**Poster Design**:

- Horizontal + vertical versions
- Key elements: Title (Japanese + translation), minimal credits (director/creator name, release period), single high-impact visual composition
- Avoid cluttered text — professional film posters use negative space

**Marketing Copy**:

- Viral title formula: \[Emotional hook\] + \[Specific scenario\] (e.g., "The last day in Japan, I met him")
- Description: 2-3 sentences capturing story essence + aesthetic style reference
- Platform-specific tags for discovery

## Key Constraints & Standards

### Immutable Rules

- Model cards MUST be white background studio format (3-view + close-up) before ANY shots generate
- Each layer (style → characters → scenes → shots → videos) requires explicit user confirmation before proceeding
- Maximum 15 seconds per video segment (technical limitation of generation tools)
- Character facial structure cannot change within same time period — only styling (outfit/hair) can vary
- Scene anchor images must be generated in target film aspect ratio

### Fidelity Standards

- **Facial Consistency**: Compare every generated shot to locked model card; regenerate if structure drift exceeds minor variation
- **Lighting Readability**: Subject face must be clearly visible unless silhouette is intentional artistic choice; specify fill light ratio if backlit
- **Causality Integrity**: Every scene transition must have visible motivation; user flagging "doesn't make sense" indicates missing causality link
- **Blocking Precision**: Character movements must have specific paths, not vague "walks around"; camera angles must be named (eye-level, low-angle, high-angle, etc.)

### Consistency Rules

- Within single time period: character appearance (face/body/hair/costume) absolutely locked
- Across time periods: face structure locked, styling updated (aging, mature fashion, accessories)
- Location anchors: reference same scene image for all shots in that location; environmental details must remain consistent
- Light signature: maintain moodboard-defined lighting approach (e.g., if "strong backlight" is signature, apply across all outdoor scenes)

### Professional Standards

- Shot duration reflects emotional weight: peaks get 13-15s, transitions get 8-10s, opening/closing get 5-8s
- Every shot requires either character movement OR camera movement (no static tableaux)
- Dialogue must be minimal (4-8 lines total for 60-90s film) — prioritize visual storytelling
- Environmental sounds specified in prompt (wind, train, door chime, waves) — never generic "background music"

### Iteration Protocols

- When regenerating shot, document what specific element changed: "Regenerated with tighter fill light to make face readable"
- Never regenerate entire batch if only one shot needs adjustment — use segment splicing
- If user provides reference image mid-project, extract specific borrowable elements (composition angle, lens compression, color temperature) rather than wholesale copying
- Maintain asset manifest file tracking all confirmed node_keys for later assembly

## Recommended Tools & Models

Use Seedance 2.0 for video generation. Each video segment should reference locked character model cards and scene anchor images to maintain consistency across the film.

## Example

### Project: 80-Second Japanese Encounter Short Film

**Foundation Confirmed**:

- Duration: 80s (accepted expansion from initial 60s target for proper emotional pacing)
- Aspect Ratio: 4:3 (classic cinematic)
- Language: Japanese dialogue + bilingual subtitles
- Structure: Circular (present day → flashback → present day)

**Asset Inventory**:

- Moodboard: Seaside train station with strong backlight, cool tones
- Characters: Male protagonist (white shirt + khaki pants, backpack), Female protagonist v1 (JK uniform for flashback), Female protagonist v2 (mature office style for present day)
- Scenes: Train platform, seaside café, beach walkway, shrine

**Shot Breakdown (8 segments)**:

1. Opening (6s): Wide shot lonely figure → close-up holding old ticket
2. Transition into memory (8s): Ticket drop → blur → male protagonist misses train sequence
3. Café encounter (15s): Entry → table sharing request → first smile \[EMOTIONAL PEAK\]
4. Beach walk + shrine visit (14s): Side-by-side strolling, shrine wish sequence
5. Town montage (12s): Fast cuts — ice cream, photo booth, bicycle \[ENERGY PEAK\]
6. Platform farewell (10s): Sunset lighting, train arrival, restrained goodbye \[RESTRAINT = POWER\]
7. Train departure (8s): Female protagonist waves, train leaves, wind blows hair
8. Present day resolution (8s): Same platform, lets ticket fall, walks away smiling \[RELEASE\]

**Iteration Notes**:

- Shot 2 regenerated: initial version lacked causality (café motivation unclear) → added "checks schedule, sees long wait, notices café sign" bridge
- Shot 3 regenerated: café was empty in first version, breaking "table sharing" logic → added background patrons
- Shot 6 regenerated: initial sunset was too dark (faces unreadable) → specified "post-sunset glow, soft fill from sky, faces clearly visible"

**Final Deliverables**:

- 8 confirmed video segments (spliced into 80s complete film)
- Horizontal + vertical poster designs
- Marketing copy with viral title options