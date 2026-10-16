---
name: shared-tooling-setup
description: Create, install or share reusable agent skills across projects, or configure their requested Codex MCP dependencies. Keep versioned sources, user-level discovery and verified connections distinct.
---

# Shared skills and MCP setup

Use for an actual skill/MCP setup request. The owner's preference is reusable, user-level skills,
with versioned sources suitable for other coding interfaces. Keep project-only commands, acceptance
gates and task tracking in project guidance. This skill does not authorize installing unrelated tools
or migrating existing connections.

## Skills: portable source and user-level access

- Use the available Skill Creator guidance for authoring/validation. Keep each skill's `SKILL.md`
  and relative references together; avoid dependencies on another project's paths or credentials.
- Put the requested Codex installation under `$CODEX_HOME/skills/<name>`, using `~/.codex/skills`
  when `CODEX_HOME` is unset. Current official guidance also documents `~/.agents/skills` as a
  user discovery root. Inspect existing discovery/configuration; where needed, link the skill there
  to the Codex-home installation without replacing an existing skill or link. Account for duplicate
  same-name entries when a versioned repository copy is also visible.
- Keep one identified versioned source. Install a matching copy and record its revision/file hashes,
  or link to a durable checkout. Do not link to a worktree scheduled for cleanup. A copy is a
  snapshot, not automatic synchronization; refresh and revalidate it when the source changes.
- Other coding interfaces can copy/link the same portable folder through their documented skills
  discovery mechanism. Do not assume Codex TOML or `agents/openai.yaml` configures those clients.
  Keep interface-specific adapters separate. Consider a plugin when packaging skills and MCP
  connections for distribution is actually requested; do not create a distribution system by default.

## MCP: configure only the requested dependencies

Skills provide instructions; MCP servers supply tools and authentication. Declaring tool dependencies
in skill metadata does not prove a connection is configured, authenticated or working.

1. Check current official Codex/server documentation and the actual client's supported configuration.
   Resolve `CODEX_HOME`; user-level MCP configuration normally lives at `~/.codex/config.toml`,
   in `[mcp_servers.<name>]` tables. Project `.codex/config.toml` may narrow or override availability.
   Plugin-managed servers have their own lifecycle; do not duplicate them as standalone entries.
2. Inspect relevant existing entries without printing secrets. Reuse a working connection. For an
   authorized addition, use the client's supported `codex mcp add` command or a narrow TOML edit;
   inspect CLI help/version first rather than assuming a PATH executable matches the desktop app.
   Preserve unrelated settings, comments, environment references and approval restrictions.
3. Use official transport/launch settings. Keep credentials out of versioned skills and sample
   configuration. Prefer supported environment-variable references or OAuth. The owner completes
   sign-in, account ownership and billing decisions; never copy tokens between unrelated clients.
   Keep a private recovery copy before editing configuration containing secrets.
4. Parse-check changed TOML, verify the intended server entry and perform a harmless relevant
   connection/tool call when available. Report separately: configured, authenticated, tools visible,
   and actually verified. A list entry or successful process launch alone is not a working tool call.
   Reload/restart the client only when necessary and at an appropriate handoff; avoid interrupting
   active work. Until then, record validation as pending rather than claiming immediate availability.

Optional tools remain optional. A skill that only needs existing screenshot/test tooling does not
justify installing a browser server, changing debug ports or granting new permissions.

## Completion evidence

Report canonical source/revision, installed path, copy/link strategy, validation and any required
client reload. Include changed MCP server names and verification results without credentials;
explicitly state when no MCP configuration changed. Do not claim checks ran in another interface
or schedule ongoing synchronization without a request.

Official references: [local skill discovery](https://learn.chatgpt.com/docs/build-skills),
[Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) and
[packaging plugins](https://developers.openai.com/plugins/build/plugins).
