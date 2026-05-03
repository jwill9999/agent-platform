# Task: Add project/work context foundation and active project binding

**Beads id:** `agent-platform-active-project`  
**Priority:** P1

## Summary

Define and implement the first-class project/work context model and active project binding inside the managed `/workspace` so coding tools, memory, sessions, and scheduled jobs can consistently associate work with the current application without the user manually providing container paths.

## Problem

The coding tools now work correctly when a project exists inside the agent runtime workspace, but manual testing still requires prompts such as `/workspace/scratch/demo-app`. Memory also already supports `scope = project`, and scheduler planning now requires project-owned jobs. Those features need a real project/work context association rather than unrelated text fields or metadata blobs.

Users should be able to ask for repository maps, code search, git diffs, related tests, and quality gates in natural language. The platform should resolve those requests to the active project path automatically.

## Requirements

- Add a durable `projects` table with at least `id`, `slug`, `name`, optional `description`, workspace path/key metadata, and timestamps.
- Add nullable `project_id` associations where current features need project context:
  - `sessions.project_id` so a conversation can belong to a project.
  - `working_memory_artifacts.project_id` or a compatible migration from plain `active_project`.
  - `memories.project_id` for indexed lookup of project-scoped memories while preserving `scope = project` / `scope_id = project.id`.
  - scheduled-job specs should consume `projects.id` for `project_id` once scheduler tables are added.
- Define association invariants:
  - A project is the durable work context for an app/repo/workspace.
  - An agent is the persona/capability profile used inside a project.
  - A session belongs to an agent and optionally a project.
  - A scheduled job belongs to a project/global/agent/session scope and may run as a selected execution agent.
  - A memory can be global, project, agent, or session scoped.
- Define the project storage convention under `/workspace`.
- Provide a way to select, restore, or infer the active project for a session.
- Persist the active project binding in platform state where appropriate.
- Make coding tools default to the active project for `repoPath` / project-level operations.
- Keep explicit path overrides available for advanced cases.
- Preserve PathJail and workspace boundary enforcement.
- Avoid requiring users to type `/workspace/...` paths for normal project work.

## Proposed Direction

- Use `/workspace/projects/<project-name>` or an equivalent managed area for real application repositories.
- Treat `projects.id` as the canonical owner id for project-scoped records.
- Track active project metadata separately from transient folders:
  - `uploads`: user-provided files
  - `generated`: generated outputs
  - `scratch`: temporary experiments and disposable apps
  - `exports`: packaged downloadable artifacts
  - `projects`: durable application repositories or mounted projects
- Expose the active project to chat/session context so tools can default safely.

## Association Model

```text
projects
  id
  slug
  name
  description
  workspace_path / workspace_key / metadata_json
  created_at_ms
  updated_at_ms

sessions
  agent_id -> agents.id
  project_id -> projects.id nullable

memories
  scope = global | project | agent | session
  scope_id = matching owner id, null for global
  project_id -> projects.id nullable for project-scoped/indexed lookup

working_memory_artifacts
  session_id -> sessions.id
  project_id -> projects.id nullable

scheduled_jobs
  project_id -> projects.id nullable
  owner_agent_id -> agents.id nullable
  owner_session_id -> sessions.id nullable
  execution_agent_id -> agents.id nullable
  created_from_session_id -> sessions.id nullable
```

The scheduler task should not invent a second project model. It should use the project/work context model defined here.

## Backwards Compatibility

- All schema changes must be additive and migrate existing SQLite databases without data loss.
- Existing sessions remain valid with `project_id = null`; users must still be able to chat without selecting a project.
- Existing memories keep their current `scope` / `scope_id` semantics. `memories.project_id` is an additive indexed association and should only be backfilled where the project owner can be resolved safely.
- Existing working-memory rows keep loading. If `active_project` already exists as plain text or metadata, migrate or map it without breaking retrieval of summaries, decisions, blockers, files, and tool summaries.
- API response changes must be additive. Existing clients that do not send or read project fields should continue to work.
- Existing explicit `repoPath` / path overrides must continue to work for advanced use cases while staying inside PathJail.
- Existing seed behaviour for the default personal assistant and coding agent must remain intact. Do not require a default project unless the implementation explicitly seeds one in a reversible, idempotent way.
- Rollout should be additive first: introduce project records and nullable associations before making any workflow require project selection.

## Tests And Verification

- Unit coverage for active project resolution and workspace-bound path validation.
- DB migration coverage from a pre-project schema, proving existing sessions, memories, and working-memory artifacts still load after migration.
- Repository coverage for project create/read/update/list, slug uniqueness, workspace metadata validation, and safe deletion or archival semantics.
- Association coverage for sessions with and without `project_id`, project-scoped memories through both `scope/scopeId` and `project_id`, and working memory with nullable project context.
- API or integration coverage proving coding tools default to the active project when `repoPath` is omitted.
- Regression coverage proving project-scoped memories can be queried through the explicit project association and existing `scope/scopeId` model.
- Regression coverage proving explicit `repoPath` overrides still work and are still PathJail-enforced.
- Scheduler spec/repository tests should consume `projects.id` once scheduler tables are introduced, rather than creating an unrelated project identifier.
- UI/manual verification that a user can select or restore a project and then ask natural-language coding-tool requests without specifying a path.
- Before close, run the affected package gates at minimum: contracts/db typecheck, lint, tests, migration tests, and any web/API checks touched by the implementation.

## Definition Of Done

- Active project path is explicit, persisted or restorable, and workspace-bounded.
- Project/work context is first-class in the database and usable by sessions, memory, and scheduler planning.
- Coding tools use the active project by default where appropriate.
- User prompts no longer need container paths for normal coding workflows.
- Existing no-project chat, memory, and explicit-path workflows continue to work after migration.
- Documentation explains workspace folders and project defaults.
