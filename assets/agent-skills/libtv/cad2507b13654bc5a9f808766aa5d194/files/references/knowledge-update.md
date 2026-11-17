# Knowledge-base update protocol

Update the knowledge base only when the user asks, supplies outcome evidence, or explicitly marks a prompt/case as reusable.

## Record schema

Append a compact record to `case-library.md`:

```markdown
## [Case ID] — [generic category + task]

- Date/model/tool: [known values only]
- Input conditions: [reference image count, aspect ratio, duration, category, material]
- Goal: [one sentence]
- Pattern combination: [opening + feature modules + ending + background]
- Identity lock: [which attributes mattered]
- Prompt move that worked: [reusable wording or structure]
- Observed result: [user feedback, render inspection, or metrics]
- Failure/repair: [if any]
- Reuse boundary: [where the rule should and should not be applied]
- Confidence: low / medium / high
```

## Admission rules

Add a pattern as “high confidence” only when at least one of these is true:

- it succeeded across two materially different products;
- a before/after test isolates the change that improved the output;
- the user approved the rendered result and the product identity remained stable;
- measurable production data supports it.

Keep single successful generations at medium confidence. Keep plausible but untested ideas in the shot library, not the case library.

## Sanitize before storage

- Replace client/product names with generic categories unless the user wants them retained.
- Remove unreleased specifications, pricing, personal data, credentials, private links, and confidential brand strategy.
- Do not store copyrighted ads, scripts, or long copied prompts from third parties.
- Store the principle and a short transformed example.
- Record the active model/tool because prompt behavior is model-dependent.

## Promote, revise, or retire

- **Promote:** move a repeated high-confidence rule into the relevant reference file.
- **Revise:** add conditions when the same rule works only for certain materials, ratios, or durations.
- **Retire:** mark a rule deprecated when model behavior changes or repeated tests fail.
- Preserve a short reason for revisions so future users do not reintroduce the failure.

Never claim that the knowledge base self-updates. Changes occur only when the skill files are explicitly edited.
