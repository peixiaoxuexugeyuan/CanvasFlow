# Scene Layout Helper Assets

Use this reference when the user requests scene/background consistency, a reusable scene asset, a top-down scene map, a blocking map, or when the same physical scene will appear across multiple generated segments.

## Required source

Prefer the complete video of the current scene / 场次. A single 10-second clip is usually insufficient to infer the whole space, all entrances and exits, and the stable standing zones of the principal characters.

If the full-scene video is missing and the user clearly wants these helper assets, stop and ask for it.

## Deliverables

Output two helper prompts before the final video prompts.

### 1. 场景资产图

Purpose:
- lock the whole space;
- lock architectural geometry and major props;
- make entrances and exits unambiguous;
- reduce background drift across segments and cuts.

Hard requirements:
- high-angle or bird's-eye top-down view;
- show the complete usable scene in one frame;
- display the full boundary of the room or area;
- clearly label every entrance and exit;
- clearly label important functional zones when relevant, such as doorway, hallway, bed area, desk area, staircase, balcony, dressing table, window wall, sofa area;
- place major fixed props in stable positions;
- prioritize spatial clarity over visual drama.

Suggested output characteristics:
- clean overhead layout style;
- readable Chinese labels;
- enough realism to preserve materials and layout;
- uncluttered composition;
- optional subtle color coding for zones.

### 2. 主要人物站位图

Purpose:
- lock where the principal characters stand in the space;
- lock relative distance and facing direction;
- lock likely movement lanes and entrances/exits used by characters.

Hard requirements:
- use the same top-down base space as the scene asset map;
- mark each principal character by name;
- mark initial standing position;
- mark facing direction;
- mark key movement path or arrow when the current segment depends on it;
- mark important prop interaction points when relevant.

Suggested output characteristics:
- clean overhead diagram style;
- readable Chinese labels;
- simple arrows and markers;
- no unnecessary decorative elements.

## How to use these assets inside video prompts

When the helper assets exist, list them once in the prompt asset-binding block:
- `场景资产图1＝...`
- `站位图1＝...`

Their responsibilities are:
- Scene asset map: global scene geometry, entrances/exits, and major background anchors.
- Blocking map: principal-character standing positions, relative spacing, facing direction, and movement route.

Do not let these helper assets override the shot's intended framing, acting beat, or camera path. They are continuity anchors, not storyboard replacements.

## Prompt writing preference

Keep helper-asset prompts direct and practical. Favor this compact style:

- first line: `画幅：...｜用途：...`
- second line: `Prompt：...`

Do not include internal-analysis explanations or model-choice boilerplate.
