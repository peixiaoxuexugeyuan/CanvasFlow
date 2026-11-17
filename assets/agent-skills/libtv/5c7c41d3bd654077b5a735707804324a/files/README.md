# Character Identity Card

An Agent Skill for creating a production-ready multi-view character identity card from one or more reference images plus optional art direction.

中文：这是一个用于 AI 图片与短视频角色资产生产的角色身份卡 Skill。输入一张或多张参考图以及可选的服装、年龄、身高或风格要求，即可生成稳定的多视角角色身份卡。身份描述和提示词用于支持身份卡生产，不是主要产品。

## What it does

- Extracts visually supported face, hair, body, and wardrobe directions.
- Separates **observed**, **requested**, and **inferred** information.
- Produces a geometry-based identity lock instead of vague beauty adjectives.
- Defaults to generating an identity card when the user provides references without naming a deliverable.
- Also supports identity-specification-only and platform-adaptation deliverables.
- Provides `headless-body` and `full-head` body-panel modes.
- Validates identity consistency, garment continuity, anatomy, skin texture, and panel completeness.
- Keeps the complete rear head and hairstyle visible in the back body panel while avoiding distant-face drift in front and side body panels.

## Safety and scope

- This Skill does not recover an original hidden prompt, seed, model, LoRA, or private generation settings.
- Reference-based results are approximations.
- Do not use identifiable real-person likenesses without permission for the intended reuse.
- When permission is unavailable, use references only for broad, non-identifying directions and create a new fictional identity.
- Do not publish user reference images or generated likeness assets without the necessary rights.

## Repository structure

```text
character-identity-card/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    ├── card-spec.md
    └── prompt-template.md
```

## Installation

### Codex

```bash
git clone https://github.com/cadyyue-blip/character-identity-card.git \
  ~/.codex/skills/character-identity-card
```

Restart the agent session if the new Skill is not discovered immediately.

### Other Agent Skills-compatible tools

Clone or copy this repository into the tool's Skill directory. The entry point is `SKILL.md`; supporting rules are under `references/`.

## Usage

Invoke the Skill and provide at least one usable character reference plus the intended direction:

```text
Use $character-identity-card.
Create an identity card from these references.
Wardrobe: minimal basics.
Presentation: photorealistic young adult.
Body-panel mode: headless-body.
Must keep: the rear hairstyle visible in the back body panel.
```

The Skill can return:

```text
Mode: identity card | identity specification | platform adaptation
Body-panel mode: headless-body | full-head
Observed identity anchors: ...
Requested direction: ...
Inferred or unresolved details: ...
Identity lock: ...
Exact generation prompt: ...
Compact platform prompt: ... (optional)
Validation notes: ...
```

Image generation is performed by the image-generation capability available in the host agent. This repository does not bundle a model, API key, or image-generation backend.

## Using it with LibTV / LiblibAI

This repository is a **character identity-card creation Skill**. LibTV's official `libtv-skill` is a separate execution Skill that connects an agent to LibTV for image and video generation.

Recommended composition:

1. Install this Skill to create the character identity card, identity lock, generation prompt, and validation rules.
2. Install the official `libtv-labs/libtv-skills` integration and configure its required LibTV access credentials according to its documentation.
3. Ask the agent to use this Skill first, then pass the finalized generation prompt and permitted reference assets to `libtv-skill` for execution.
4. Keep the generated identity card as the identity anchor for later LibTV image-to-video or multi-shot workflows.

Publishing this repository on GitHub does not automatically list it inside LibTV. To request inclusion in LibTV's official repository, open an Issue or submit a Pull Request to `libtv-labs/libtv-skills` and follow the maintainers' review requirements.

## License

MIT. See [LICENSE](LICENSE).