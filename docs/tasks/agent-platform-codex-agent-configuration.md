# Task: Add project-scoped Codex agent configuration

**Beads issue:** `agent-platform-codex-agent-configuration`  
**Spec file:** `docs/tasks/agent-platform-codex-agent-configuration.md`

## Summary

Create the supported repository structure for project-scoped Codex custom agents, global subagent
settings, and reusable skills.

## Requirements

- Store custom agent TOML definitions under `.codex/agents/`.
- Define global subagent settings in `.codex/config.toml`.
- Store repository-scoped skills under the supported `.agents/skills/` discovery path.
- Include starter definitions without pinning a model or reasoning effort.
- Document required metadata, optional skill resources, and how to extend the scaffold.

## Implementation Plan

1. Add project-level Codex configuration.
2. Add focused exploration, review, test, and implementation agents.
3. Add the supported skill authoring location and document its optional resource directories.
4. Validate TOML, YAML, formatting, links, and repository documentation.

## Tests And Verification

- Parse every TOML file with a standards-compliant TOML parser.
- Run repository formatting and documentation gates.

## Definition Of Done

- [x] `.codex/config.toml` defines project subagent defaults.
- [x] `.codex/agents/` contains valid, focused custom agent definitions.
- [x] `.agents/skills/` documents the supported structure for adding real repository skills.
- [x] Configuration and documentation checks pass.
