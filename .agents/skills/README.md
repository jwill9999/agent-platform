# Repository skills

Codex discovers repository-scoped skills from `.agents/skills/`. Each skill is a directory whose
required `SKILL.md` contains YAML frontmatter with a unique `name` and a precise `description`.

```text
.agents/skills/
└── <skill-name>/
    ├── SKILL.md              # required instructions and metadata
    ├── agents/openai.yaml    # optional UI metadata and dependencies
    ├── assets/               # optional templates and resources
    ├── references/           # optional supporting documentation
    └── scripts/              # optional deterministic helpers
```

Create a lowercase, hyphenated directory for each real skill. Its `SKILL.md` starts with:

```yaml
---
name: skill-name
description: Explain exactly what the skill does and when it should activate.
---
```

Keep only the optional directories the skill actually uses. Do not add placeholder skills: every
discovered `SKILL.md` becomes a selectable runtime capability.

Codex detects skill changes automatically. Start a new session or restart Codex if a new skill does
not appear.

See the [official OpenAI skill authoring guide](https://learn.chatgpt.com/docs/build-skills).

## Documentation workflow

Use [documentation](documentation/SKILL.md) for repository locations and authoritative records, then
[agent-platform-documentation](agent-platform-documentation/SKILL.md) for publishing the changed
material to Notion. The latter is bundled here with its destination map, so it does not depend on a
personal skill installation. Planning, critique and implementation already enter through the
documentation workflow; read-only roles return publication instructions to an authorized publisher.

## Native development default

[Feature planning](feature-planning/SKILL.md), [implementation](feature-implementation/SKILL.md)
and [independent critique](plan-critique/SKILL.md) use native Codex tools within agreed task authority.
[Orchestration](orchestration/SKILL.md) is a PAUSED explicit prototype route, never an ordinary
product-ticket prerequisite. See [current developer policy](../../docs/development/codex-development.md).
