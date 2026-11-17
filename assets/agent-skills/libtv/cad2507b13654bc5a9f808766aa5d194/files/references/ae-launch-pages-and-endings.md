# AE launch pages and ending systems

## Contents

1. Purpose and boundary
2. Page-sequence grammar
3. Four page archetypes
4. AE text-entrance recipes
5. Feature-chip animation
6. Two-tier comparison ending
7. Lineup comprehensive board
8. Layer and naming specification
9. Copy-to-motion mapping
10. Sound and transition map
11. Originality-distance gate
12. Delivery template

## 1. Purpose and boundary

Translate premium technology-launch mechanisms into an original motion system for the user's product. The supplied references may reveal hierarchy, pacing, or information density; do not trace their exact grid, typography, button language, colors, product naming, spacing, or animation timing.

For parody, make the joke legible without presenting the work as official. Use an original brand lockup and, when distribution context could confuse viewers, add a small truthful label such as `非官方创意演绎` or `戏仿短片`. Never use an Apple logo, proprietary typeface, copied slogan, copied UI, or false endorsement.

Use `Pro / Pro Max` only when those are the user's authorized model names. Otherwise derive truthful tiers from real differences, for example `轻巧版 / 畅饮版`, `清爽版 / 强气泡版`, `标准装 / 大容量装`, or the user's own naming system.

## 2. Page-sequence grammar

Use three or four pages. One page communicates one conclusion.

| Order | Page job | Typical duration | Copy load | Visual proof |
|---|---|---:|---|---|
| P1 | verdict/chapter | 1.8–3.0s | tag + 1–2 headline lines | giant product detail or silhouette |
| P2 | feature evidence | 2.5–4.5s | 3–6 short labels | product plus real features |
| P3 | tier comparison | 2.5–4.0s | names + 1 factual difference each | two products or variants |
| P4 | family ending | 3.0–5.0s | positioning line + model names + optional CTA | lineup board or final hero |

Maintain `claim → visible evidence → selection → memory`. Never show price, ingredients, capacity, performance, certifications, or availability unless supplied and verified.

## 3. Four page archetypes

### A01 — Chapter verdict over architectural product

Use for a black-stage manifesto or material/design claim.

- Canvas: pure black or charcoal chosen from the user's brand palette.
- Composition: headline occupies the upper 35–45%; product occupies the lower 35–55% and may extend beyond frame.
- Product: extreme-low side profile, macro architecture, or partial silhouette; do not begin with an ordinary full front view.
- Text stack: accent chapter tag, two-line verdict, optional two-line evidence paragraph.
- Originality move: use off-center alignment, vertical chapter tag, split headline, or brand-colored rule; do not clone a centered Apple launch page.
- Copy pattern: `[事实类别]` → `[可见结构]，` / `[真实结果]。`

### A02 — Feature constellation

Use for an interface-like feature page without reproducing a store or product-page UI.

- Product occupies 42–58% of frame; feature labels occupy the opposite rail.
- Use 3–6 labels, 3–8 Chinese characters each.
- Prefer staggered cards, numbered capsules, thin-rule tabs, or radial callouts. Do not copy a specific pill stack.
- Every label points to a visible feature, ingredient, action, or verified specification.
- Reveal labels in proof order, not merely top-to-bottom.
- Reserve one accent color derived from the product, not a borrowed brand blue/orange.

### A03 — Two-tier comparison

Use when the user actually has two variants.

- Align both products on one baseline or one shared axis.
- Give each tier one positioning line and no more than three differences.
- Emphasize difference through real scale, capacity, flavor, finish, or use case—not arbitrary status.
- Prefer original asymmetry: primary tier 56–62% visual weight, secondary tier 38–44%.
- End with the user's brand family name above or between the tiers.
- If differences are unknown, output a comparison shell with `[待核实]`; do not invent them.

### A04 — Lineup comprehensive board

Use for the final “all models at a glance” image.

- Default layout: `1+3 asymmetric matrix`, not four equal cards.
- Lead card: 42–48% canvas width, richer background, full product pair or best-seller.
- Secondary zone: three cards in a vertical stack or 2+1 arrangement.
- Each card contains: verified product image, name, one positioning sentence, 1–3 true differentiators, optional supplied price, and an original CTA.
- Use 3 or 5 products when possible to create a distinct rhythm. If exactly four exist, vary card size or hierarchy.
- Suggested CTAs: `看看哪款适合你` / `找到你的清爽` / `查看口味` / `了解系列`. Avoid copying reference CTA wording.
- Use tinted neutral backgrounds or the user's palette; avoid copying exact white field, card radius, dot colors, and blue buttons from the reference.

## 4. AE text-entrance recipes

Default to 25 fps. Values are starting points, not a proprietary timing trace. Convert by seconds when using another frame rate.

### T01 — Mask-rise verdict

Best for one decisive headline.

| Property | Start | End | Duration |
|---|---:|---:|---:|
| position Y | +28 px | 0 px | 14–18f |
| opacity | 0% | 100% | 10–14f |
| mask feather | 8 px | 0 px | 14–18f |
| line stagger | — | — | 4–6f |

Use an 80/20 ease-out. Keep the first line visible for 4–6f before the second line begins. Hold at least 20f before the next information event.

### T02 — Blur-resolve proof

Best for evidence or a sensory turn.

| Property | Start | End | Duration |
|---|---:|---:|---:|
| Gaussian blur | 16–22 | 0 | 10–14f |
| tracking | +24 to +36 | 0 | 12–16f |
| opacity | 0% | 100% | 10–14f |
| scale | 101.5% | 100% | 14–18f |

Synchronize full sharpness to the product light sweep reaching the claimed feature.

### T03 — Clause hinge

Best for `岂止于…，更在于…` mechanisms without copying a campaign.

1. First factual clause enters in 10–14f.
2. Hold 5–8f on the comma or line break.
3. Second evidence-bound clause enters in 12–16f.
4. Hold the complete sentence for at least 24f.

Do not animate individual Chinese characters unless the rhythm has a reason. Prefer phrase units.

### T04 — Chapter tag snap

Best for a small category label above the headline.

- opacity 0→100% in 6–8f;
- position X −12→0 px or scale 96→100%;
- optional 2f accent-line draw;
- enter 6–10f before the headline;
- use the user's accent color.

### T05 — Naming lockup

Best for the final product family.

- brand/series fades in over 10–14f;
- tier names follow 5–7f later;
- one difference line follows after both products settle;
- no bounce, elastic overshoot, or excessive glow;
- hold the complete lockup for 1.2–2.0s.

## 5. Feature-chip animation

Build chips as AE shape layers and live text, not baked text in generated images.

Recommended layer contents: background shape, 1 px border or subtle inner highlight, optional number/icon, verified label, link line or anchor dot.

Entrance recipe per chip:

- opacity 0→100% over 8–10f;
- scale 96→100% over 10–12f;
- position X ±18→0 px over 12–16f;
- 4–6f stagger between chips;
- no more than two chips animate simultaneously;
- link line draws over 8–12f after the chip reaches 70% opacity.

Sequence chips according to the camera/light proof path. If the light reveals the cap, label the cap first; if bubbles rise, reveal carbonation before flavor. Keep at least 8f between the last chip and the next page transition.

## 6. Two-tier comparison ending

### Layout

- shared background and baseline;
- one product at 100% reference scale, the other at truthful relative scale;
- 8–12% center gap or an intentional overlap no greater than 8%;
- names below or beside products, not over key labels;
- one verified differentiator under each name.

### Motion timeline for a 3.2s page at 25 fps

| Frames | Event |
|---:|---|
| 00–14 | secondary tier glides in 24 px and fades up |
| 06–22 | primary tier glides in from the opposite side, larger visual weight |
| 20–34 | soft edge light travels across both variants |
| 28–42 | tier names enter using T01 or T02 |
| 40–54 | one factual difference line appears |
| 54–80 | complete comparison holds; sound resolves |

Use matching motion directions from the prior shot. Do not invent a bigger tier solely to mimic a phone family.

## 7. Lineup comprehensive board

### Original `1+3` system

For 16:9, start from a 12-column grid with 6–8% outer margins and 1.5–2.5% gutters.

- Lead card: columns 1–5 or 1–6, full height of the card zone.
- Secondary cards: remaining columns in a 2+1 or stacked layout.
- Headline: top-left or vertical side rail, not a copied centered store header.
- Comparison action: place one understated text link in a brand-specific location.
- Product names: 26–40 px at 1920×1080; positioning lines 18–26 px; legal/price text 13–18 px.
- Card radius: derive from the user's own system; square, clipped, or mixed radii are acceptable.
- Color selectors: use labeled swatches or ingredient/flavor chips when they convey real variants.

### Entrance for a 4.0s board at 25 fps

| Frames | Event |
|---:|---|
| 00–12 | page field and section title fade/slide into place |
| 08–26 | lead card reveals through a vertical matte |
| 16–38 | secondary cards enter with 5f stagger |
| 30–48 | products settle from 103→100% scale |
| 42–62 | names and positioning lines appear |
| 56–72 | selectors/CTA appear only if needed |
| 72–100 | full board holds for reading or ends on a single brand memory line |

For video, do not animate every price, selector, and CTA. Choose one information priority. For a still comprehensive image, include the full verified matrix.

## 8. Layer and naming specification

Use a predictable AE structure:

```text
P##_PAGE_NAME
  00_BG
  10_PRODUCT_A
  11_PRODUCT_B
  20_LIGHT_SWEEP
  30_TAG
  31_HEADLINE_L1
  32_HEADLINE_L2
  33_BODY
  40_CHIP_01 ... CHIP_06
  50_MODEL_NAME_A
  51_MODEL_NAME_B
  60_CTA_OR_DISCLOSURE
  90_ADJUSTMENT
```

Keep text live, use paragraph/character styles, separate Chinese and Latin fallback fonts, and protect 5–8% title/action safe margins. Use a licensed neutral sans or brand font; never ask for SF Pro imitation.

## 9. Copy-to-motion mapping

| Copy role | Motion | Picture event | Sound cue |
|---|---|---|---|
| chapter tag | T04 snap | first edge highlight | dry tick |
| verdict | T01 mask-rise | giant structure becomes identifiable | low impact |
| proof | T02 blur-resolve | detail reaches focus/full light | precise click or fizz |
| contrast turn | T03 clause hinge | before/after or two states meet | short pause then lift |
| tier name | T05 lockup | products align | tonal resolve |
| family board | card stagger | lineup settles | restrained chord tail |

Never let copy arrive before its proof. If the viewer cannot point to the evidence, rewrite or delay the line.

## 10. Sound and transition map

- tag: short dry tick, not a loud whoosh;
- mask-rise: low soft pressure or material scrape;
- blur resolve: glassy click, fizz, or focused transient tied to the product;
- chip: one shared rhythmic family with varied pitch, not six unrelated sounds;
- tier alignment: paired impacts panned subtly left/right;
- lineup hold: resolve into silence or a short brand tone.

Match transitions using one anchor: edge direction, product axis, accent color, light travel, circular feature, or final sound tail. Use only one dominant anchor per cut.

## 11. Originality-distance gate

Pass before delivery. Change at least three of these seven codes from any supplied reference:

1. grid and alignment;
2. palette and accent color;
3. typeface and type scale relationship;
4. card/chip geometry;
5. CTA wording and placement;
6. product-tier naming;
7. animation order and timing.

Also confirm:

- no Apple logo, copied slogan, proprietary font, copied product UI, or copied page text;
- no exact four-equal-card store layout when a supplied reference uses it;
- no decorative `Pro / Pro Max` for an unrelated product;
- no false price, feature, material, or performance claim;
- no implication of official endorsement;
- parody disclosure is present when viewers could reasonably be confused.

Fail the gate if the result would be recognized through the combination of typography, grid, CTA, naming, and timing even after the products were blurred. Redesign the system rather than making token changes.

## 12. Delivery template

```markdown
## AE 页面系统

### P01｜宣言页（00:00–00:02.4）
- 构图：
- 图层：
- 文案：
- 入场：
- 定格：
- 退场/转场锚点：
- 声音：

### P02｜参数证据页（00:02.4–00:05.8）
[同上]

### P03｜双版本对比（可选）
[真实型号与差异]

### P04｜全系综合页
- 布局：1+3 非对称矩阵 / 其他原创布局
- 卡片字段：
- 动画时间线：
- CTA：
- 非官方说明（需要时）：

**原创距离检查：** [改变的至少三项品牌代码]
**事实待核实项：** [列表或“无”]
```
