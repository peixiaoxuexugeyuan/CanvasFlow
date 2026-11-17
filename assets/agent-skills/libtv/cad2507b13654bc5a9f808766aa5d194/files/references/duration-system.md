# Duration system

## Contents

1. Input model
2. Segment allocation
3. Internal cadence
4. Shot count and reading time
5. Duration presets

## 1. Input model

Classify each segment:

- `light`: 1–2 information beats, weight 0.8;
- `medium`: 3–4 beats, weight 1.0;
- `heavy`: 5+ beats, weight 1.25;
- `brand`: hero lockup, variants, name/action, weight 1.0.

Minimum usable segment length is normally 4 seconds; preferred range is 5–15 seconds. If the requested duration cannot hold all claims, reduce claims before shortening every shot.

Run:

```bash
python scripts/plan_timeline.py --total 30 --densities medium,heavy,brand --format markdown
```

Or specify only a count:

```bash
python scripts/plan_timeline.py --total 20 --segments 3 --format json
```

## 2. Segment allocation

Allocate proportional to density weights, round to 0.5 seconds, then correct the final segment so durations sum exactly to the requested total. Preserve at least 4 seconds per segment. If impossible, output a warning and use equal allocation.

Information priority:

1. product recognition;
2. primary promise;
3. visual proof;
4. secondary proof;
5. variant/accessory;
6. brand/action.

## 3. Internal cadence

Default split for each segment:

| Segment duration | Reveal | Articulation | Signature |
|---|---:|---:|---:|
| 5 s | 0–1.5 | 1.5–3.5 | 3.5–5 |
| 7 s | 0–2.5 | 2.5–5 | 5–7 |
| 8 s | 0–3 | 3–6 | 6–8 |
| 10 s | 0–4 | 4–7 | 7–10 |
| 12 s | 0–5 | 5–9 | 9–12 |
| 15 s | 0–6 | 6–11 | 11–15 |

For other durations, start near 40% / 32% / 28%. Shift up to 10 percentage points from reveal to articulation when functionality matters more than ceremony.

## 4. Shot count and reading time

- 5–7 s: 2–4 shots.
- 8–12 s: 3–6 shots.
- 15 s: 5–8 shots.
- 20–30 s: 7–14 shots.
- 45–60 s: 12–24 shots, organized into chapters.

Allow roughly 0.8–1.2 seconds for a short Chinese phrase after it becomes fully legible; longer claims need more. Avoid adding text during the fastest camera move.

## 5. Duration presets

### 6 seconds — single proof

`0–2 clue/reveal → 2–4.5 proof → 4.5–6 hero/name`

### 15 seconds — social product film

`0–4 rare-angle hook → 4–10 two or three proofs → 10–13 hero/variant → 13–15 name/action`

### 30 seconds — launch capsule

`0–7 reveal → 7–20 feature chapters → 20–26 material/variant crescendo → 26–30 brand signature`

### 45–60 seconds — full story

Use 3–5 chapters. Give each chapter its own micro-curve while preserving one macro arc. Introduce environment or human use only if it proves a benefit that studio abstraction cannot.
