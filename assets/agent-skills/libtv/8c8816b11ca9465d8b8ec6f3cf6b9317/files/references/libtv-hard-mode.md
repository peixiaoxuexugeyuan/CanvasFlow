# LibTV 强制执行模式

Use this reference when a less capable prompt agent makes ordinary courtyards, small temples, flat cloud backdrops, weak Chinese identity, or generic cinematic haze. Do not ask it to infer scale or composition from adjectives. Give it visible locks.

## Non-negotiable checklist

Pass every item before returning a prompt.

1. **One giant subject** — State one palace, gate, roof, column, stair, or cliff-palace as the dominant mass. It must occupy a named half/third of the image or crop out of a frame edge; do not describe a complete normal-size facade.
2. **One spatial geometry** — State a single central axis, side vanishing point, circular portal, or diagonal colonnade. State the line that proves it: skyway, stairs, rails, tiles, columns, or eaves.
3. **One scale witness** — State exact count, lower/edge placement, back/side orientation, robe colors, and a quiet action. Pair it with a human-scale door, railing, lamp, step, or tile bay. Do not ask for a face.
4. **Chinese structure, not a fantasy label** — Name at least three: white-jade `须弥座`, dragon-carved stone column, cinnabar lacquered pillar, dark timber beam, dougong, layered eaves, caisson ceiling, stone balustrade, bronze lamp, or wet stone platform. Use no more than two main material families plus one accent.
5. **Atmosphere with contrast** — State a cool shadow field, one warm directional source, two or three cloud/mist depth layers, and what remains visible through haze. Never allow fog to erase the giant mass.

## Prompt compiler

Write one continuous Chinese prompt in this exact order. Replace every bracket before delivery; never leave brackets in the final text.

```text
16:9，东方天宫巨构电影写实定帧。最高画面优先级： [唯一巨构] 占据[画面上半部/左侧三分之二/出画的近景]，体量远超人类且[压住天空/伸出画框]；它不是完整正常尺寸的宫殿立面。构图锁定为[唯一镜头家族]，[焦段和机位]，[中轴/偏侧消失点/环形曲线]只由[天路、台阶、栏杆、柱列或屋檐]组织。前景[被裁切的巨构构件]形成景中景；中景[人、天路或唯一奇观]；远景[仍然巨大且可读的巨构/门洞/宫城]穿过[两到三层云雾]。仅有[人物数量]名[背向/侧向]长袍见证者，位于[画面下缘或边缘]，穿[衣色]，正在[安静动作]；[栏杆/门/灯/阶梯/地砖]证明人类尺度，人物没有脸部特写。[三到五个东方结构词]，材质限定为[两种主材]与[一个点缀]。画面左/右侧保留[冷蓝灰阴影或深色木构]，来自[左/右后方]的[暖金/铜色/月白]光只勾亮[屋檐、门洞、云边或湿地面]；雾只软化远景表面，不遮住[巨构轮廓、主门洞或主体边缘]。情绪[庄严、孤绝、神圣、克制]，无文字，无水印。
```

## Mandatory negative prompt

Keep this compact and send it as a separate negative prompt, never hidden inside the positive description.

```text
普通小宫殿，完整人间庭院，园林和盆景，主体小且居中，空洞云海背景，平面背景板，人物特写，脸部特写，拥挤人群，现代建筑，玻璃幕墙，罗马柱，希腊神庙，哥特教堂，欧洲古典建筑，多重消失点，多条主路，多个奇观，浓雾吞没主体，全局金色滤镜，霓虹，卡通，网游感，文字，字幕，水印，logo
```

## Rewrite triggers

Discard and rebuild the prompt if any of these appear in the first result:

- The building is fully visible and reads as a normal palace: crop a giant roof, column, arch, or platform and explicitly state that it exits the frame.
- The cloud sea looks like wallpaper: add a foreground/middle/distant cloud layer and a rail/stair/column system converging into one geometry.
- The scene could be any fantasy culture: replace generic terms with at least three named Chinese structural elements and a limited jade/lacquer/dark-timber/bronze palette.
- The image is bright but has no gravity: create a cool shadow field, preserve dark timber or blue-gray sky, and use one directional warm rim rather than global golden glow.
- The image has many beautiful things but no focus: remove every anomaly except one and restore the giant structure as the first clause.
