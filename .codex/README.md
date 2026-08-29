# Project Codex configuration

This directory contains repository-scoped Codex configuration and custom agent definitions.

```text
.codex/
├── config.toml
└── agents/
    ├── code-reviewer.toml
    ├── implementation-worker.toml
    ├── repo-explorer.toml
    └── test-runner.toml
```

Each file under `agents/` defines one custom agent. The `name` field is the agent identity; matching
the filename to that name with hyphens converted to underscores keeps the definitions easy to find.
Every custom agent must define `name`, `description`, and `developer_instructions`.

Models and reasoning effort are intentionally omitted so agents inherit the active parent session's
compatible settings. Add `model` and `model_reasoning_effort` to an individual TOML only when that
agent needs an explicit override.

Repository skills do not live under `.codex`. Codex discovers them from
[`../.agents/skills/`](../.agents/skills/README.md).

References:

- [OpenAI subagent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents?surface=app)
- [OpenAI skill authoring](https://learn.chatgpt.com/docs/build-skills)
