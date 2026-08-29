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
