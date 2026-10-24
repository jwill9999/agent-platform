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

Use [documentation](documentation/SKILL.md) for repository locations and authoritative records.
External publication is performed only when explicitly requested. Routine changes do not require
Notion mirrors or generated publication files.

Keep the existing project-specific skills here. Create new reusable skills in the owner's shared user
skills directory (`~/.agents/skills`, which Codex reads alongside this folder), not in this repository. Use supported
discovery links for other coding interfaces when requested; do not create another source copy here.

## Native development default

[Feature planning](feature-planning/SKILL.md), [implementation](feature-implementation/SKILL.md)
and [independent critique](plan-critique/SKILL.md) use native Codex tools within agreed task authority.
[Orchestration](orchestration/SKILL.md) is a PAUSED explicit prototype route, never an ordinary
product-ticket prerequisite. See [current developer policy](../../docs/development/codex-development.md).
