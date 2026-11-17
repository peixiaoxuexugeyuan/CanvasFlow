---

## name: y2k-surreal-poster description: "Generate 3:4 vertical Y2K weirdcore surreal collage posters from any short phrase, scene description, or concept word. Apply a mandatory triple alienation process (subject, object, action) to construct absurdist surreal scenes, supplement with Y2K visual elements from the element library, and produce a final image via the ImageGen tool. Trigger phrases include: y2k, Y2K, y2k海报, Y2K海报, 生成海报, 生成图片, 超现实海报, 荒诞海报, 按此Skill生成海报. Also triggers when the user provides a short phrase or concept and asks for a surreal/Y2K/absurdist visual interpretation." agent_created: true

# Y2K Surreal Poster Generator

## Overview

Transform any short phrase, scene description, or concept word into a 3:4 vertical Y2K weirdcore surreal collage poster. The core creative engine is a mandatory **triple alienation** process that warps subject, object, and action to produce genuinely absurdist imagery -- never literal illustration.

## Workflow

Execute the following four steps in order. Before starting, load the Y2K element library:

```
Read references/y2k_element_library.md
```

### STEP 1: Element Extraction

Extract three core elements from the user input:

ElementDefault (when absent)**Subject** (主体)"human" (人类)**Action** (动作)"using" (使用)**Object** (客体)"object" (物体)

For multi-word inputs (e.g., "上班、地铁、手机"), treat each word as a candidate element and select the most evocative combination. For empty or "random" input, use all three defaults.

### STEP 2: Triple Alienation (Mandatory)

Apply all three alienation types. This step is non-negotiable -- every generation MUST include all three.

2a: Subject Alienation (pick 1 randomly)

- **Species swap**: Transform into alien, humanoid animal, or non-human creature
- **Proportion distortion**: Gigantification or miniaturization
- **Material replacement**: Skin becomes metal, jelly, CRT screen, etc.

2b: Object Alienation (pick 1 randomly)

- **Scale shift**: Extremely large or extremely small
- **Material anomaly**: Becomes cloud, balloon, mechanical parts, etc.
- **Functional inversion**: Purpose completely reversed

2c: Action Alienation (forced logical displacement)

- Invert: "Not A does B, but B does A"
- OR complete the action through unconventional senses/methods
- Example: "drinking coffee" becomes "coffee drinking the person" or "drinking through fingertips"

### STEP 3: Environment Supplementation

Based on the alienated subject (NOT the original), select 3 environment/background elements from the Y2K Element Library (see `references/y2k_element_library.md`). The elements must relate to the alienated subject -- do not randomly stack unrelated elements.

Selection process:

1. Read the element library categories
2. Identify which categories resonate with the alienated subject
3. Pick 3 elements that create visual tension or narrative coherence with the alienated scene

### STEP 4: Prompt Construction + Image Generation

4a: Construct the Prompt

Assemble the final English prompt by concatenating:

1. **Style prefix** (FIXED -- always prepend exactly as written below):

```
Vertical lo-fi internet collage poster, Y2K weirdcore maximalism,
fluorescent colors, surreal collage, blending realistic photos,
3D cartoons, hand-drawn doodles, garbled text, rough cutout
collage edges, hand-drawn arrows, glitch typography, sticker labels.
```

2. **Scene description**: Translate the triple-alienated scene + 3 environment elements into a vivid English paragraph.

3. **Aspect ratio hint**: Append `, 3:4 vertical composition` (or the user's requested ratio).

Example assembled prompt:

```
Vertical lo-fi internet collage poster, Y2K weirdcore maximalism,
fluorescent colors, surreal collage, blending realistic photos,
3D cartoons, hand-drawn doodles, garbled text, rough cutout
collage edges, hand-drawn arrows, glitch typography, sticker labels.
A miniature office worker trapped inside a glacier-sized smartphone,
transparent glass fingers shuffling the worker like a deck of cards,
Windows XP error popups raining from a sky of pixelated 8-bit clouds,
a disco ball sun melting into the horizon, CRT TV-headed observers
watching from below through a fisheye lens, 3:4 vertical composition
```

4b: Generate the Image

Use the **ImageGen** tool to generate the image. Load the tool schema first via ToolSearch, then call via DeferExecuteTool.

Parameters:

ParameterValue`prompt`The fully assembled prompt from step 4a`size1024x1536` for 3:4 vertical (default). Use `1024x1024` for square, `1536x1024` for landscape`qualityhighn1`

After generation, use `present_files` to present the image to the user.

Alternative: LibTV CLI

If the ImageGen tool is unavailable, use the LibTV CLI (`C:\Users\jy\.libtv\libtv.exe`) as an alternative. Refer to the `libtv-cli-guide` skill for usage details. Recommended model: LibNano Pro.

## Output Format

For each generation, present the output in this structure:

1. **Construction process table**: Show the extracted elements, alienation choices, and selected environment elements in a markdown table
2. **Alienation explanation**: Brief 1-2 sentence explanation of the creative logic
3. **Assembled prompt**: Show the final English prompt
4. **Generated image**: Present via `present_files`
5. **Post-generation decode**: After the image is generated, decode the absurdist elements and explain what makes the scene surreal
6. **Next step prompt**: Suggest follow-up actions (regenerate, tweak alienation, try new input, adjust ratio, etc.)

## Creative Discipline

1. **Triple alienation is mandatory** -- all three types (subject, object, action) must be applied every time, without exception
2. **Environment elements must relate to the alienated subject** -- never randomly stack unrelated Y2K elements
3. **Style prefix is fixed** -- always prepend the exact style prefix text to every prompt, do not modify or paraphrase it
4. **Show construction before generation** -- always display the creative process (table + explanation) before generating the image
5. **Decode after generation** -- always explain the absurdist elements after the image is produced, and suggest next steps

## Input Handling

Input typeHandling"随机" / "random"Randomly pick 3 elements from the library and construct a sceneShort phrase (e.g., "一个人在喝咖啡")Extract subject/action/object, then apply triple alienationMultiple words (e.g., "上班、地铁、手机")Treat each word as a candidate element, select most evocative combinationEmpty inputUse defaults: human x using x object, then alienate

## Historical Case Reference

SceneAlienation combo手机在刷人Miniature office worker x Glacier phone x Transparent fingers shufflingBug在修复程序员Giant octopus x Glowing bug code x Beetle soldering circuit board人脸云的围观CRT TV-head girl x Face-balloon cloud matrix x Fisheye upward angle迪斯科球的公迁Liquid metal human x Melting disco ball sun x Popup waterfall sky

More detailed cases and the full element library are in `references/y2k_element_library.md`.