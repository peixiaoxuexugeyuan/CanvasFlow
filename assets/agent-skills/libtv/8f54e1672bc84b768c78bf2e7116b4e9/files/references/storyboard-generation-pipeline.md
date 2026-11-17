# Storyboard-to-Generation Pipeline

> Status: v0.2 provisional. Independently rewritten from transferable concepts in source S001;
> fixed short-drama rules and protected expression were excluded.

## Four gates

### Gate 1 — Directing map

Do not write generation syntax yet. Build a shot map with:

- Approved brief/script/claim anchor.
- Audience information or emotion before and after the shot.
- Primary dramatic, product, mnemonic or compliance job.
- Visible event, performance and sound relationship.
- Entry/exit relationship to adjacent shots.

A source unit may map to several shots; several source units may share one shot. Coverage is mandatory,
but mechanical one-line-to-one-shot translation is not.

For product-led work, mark each shot's causal role: friction, trigger, response, proof, changed state or
payoff. For multi-feature films, register each scenario module's entry/exit state and primary capability.

### Gate 2 — Time and rhythm budget

Run parallel clocks:

- Visual action and performance time.
- Dialogue/VO playback time, including breath and transition allowance.
- VO/dialogue span and designed-SFX sync-event time.
- Super, CTA, logo and legal-copy readable hold.
- Model-stable generation span and extension risk.

The edit span must satisfy every clock that occupies it. Use scratch VO/TTS or a read-through when
copy timing matters; word-count formulas are estimates, not proof. Allocate in frames for locked delivery.
Do not add empty coverage merely to hit duration—every added or extended shot needs an explicit job.

### Gate 3 — Production batches

Give each shot a consistency signature:

`character/product identity + wardrobe/packaging + location topology + time/weather + key-light logic +
prop state + action start/end + camera grammar + target model/mode`

Batch shots only when the signature and the model's tested capacity support it. Split when a critical
state changes or when one failure would force expensive regeneration. Macro inserts, POV, environment
plates, abstract transitions and packshots may be isolated as lower-dependency coverage.

### Gate 4 — Model-facing generation package

Translate approved decisions into the smallest model-facing prompt. Keep the following in the director
record even if the generator does not need them:

- Source and approval anchors.
- Time calculations and confidence.
- Continuity state and batch signature.
- Product, brand and legal checks.
- Acceptance criteria, risks and fallbacks.

Output adapters may change syntax and fields. They may not change the underlying directing decisions.

## Action-state handoff

For human, vehicle, product-operation, liquid, fabric or transformation shots, record:

1. Start state: pose, gaze, hand/prop positions, direction and velocity.
2. Change: one controllable action arc with visible cause and progression.
3. End/handoff state: a completed action or a state the next shot can inherit.

The next shot must either inherit the handoff or declare a motivated discontinuity. Intentional holds,
tableaux, still-life packshots and end cards are allowed; distinguish them from accidental model freezing.

## Visual bible and shot deltas

Store global rules once: aspect ratios and safe zones, brand/product invariants, realism, palette, contrast,
light logic, optical behaviour, texture, motion cadence and prohibited drift. Per-shot prompts describe only
what changes, while still carrying any identity token the target model needs repeated.

## Adaptation modes

- **Strict adaptation:** locked copy, claims and event order; changes require approval.
- **Director interpretation:** approved information stays intact, but montage, point of view and visual order may change.
- **Concept development:** proposals may add metaphors or events, clearly marked until approved.

Choose a mode per project or per sequence. Never treat a proposal as an approval.

## TVC quality gates

Before generation, check:

- All mandatory claims, products, CTA and legal elements have a visual/audio carrier.
- No unsupported capability, result, certification or product behaviour was invented.
- The time budget includes VO/dialogue, SFX events, supers, packshot and legal holds.
- Lens, camera and movement choices express perspective and drama rather than equipment name-dropping.
- Light instructions specify observable direction, ratio, color and material response.
- Adjacent states match or the discontinuity is motivated.
- Batch boundaries follow identity and continuity risk, not an arbitrary global duration.
- The generator prompt is clean; the audit record remains available to director and production.
- Product proof follows a readable trigger/response chain and changes the next character/product state.
- Treatment rules trace to shot evidence; key shot decisions trace to approved rules or labelled proposals.
- Claims have evidence grades and approved carriers; model imagery does not upgrade them.
- Each shot passes both the creative-layer and production-layer audit before prompt serialization.
