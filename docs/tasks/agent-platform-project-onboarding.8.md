# Task: Add extensible slash commands for Project onboarding

**Beads issue:** `agent-platform-project-onboarding.8`  
**Spec file:** `docs/tasks/agent-platform-project-onboarding.8.md`

## Summary

Add first-class slash-command handling to the new harness/chat path, with `/init` as the first
Project onboarding command. The command system must be reusable for future commands and must not rely
on fuzzy model interpretation of user text.

## Requirements

- Add an extensible slash-command dispatch path before normal model execution.
- Treat `/init` as a deterministic Project onboarding command, not ordinary chat text.
- Keep the command framework generic so later commands can register name, aliases, scope,
  validation, execution, and user-facing help text.
- Keep slash command behavior consistent across entry points:
  - chat submission from the IDE assistant.
  - any future chat-first Project surface.
  - future UI CTAs that invoke the same command directly.
- Design for extension from the start:
  - `/init` is only the first built-in command, not a special case.
  - new built-in commands can be registered without changing parser logic.
  - future plugin/skill/project-local commands can be introduced by replacing or composing the
    registry implementation.
  - command metadata must be rich enough for help/autocomplete and validation.
  - command execution must support commands that only return text and commands that invoke
    application workflows with approval gates.
- Follow the repo's clean architecture pattern:
  - expose slash-command parsing and dispatch through application-layer ports/use cases.
  - keep HTTP/UI/harness entry points as adapters that call the same command boundary.
  - keep command definitions independent from web components and Express route handlers.
  - make parser, registry, and executor implementations swappable behind interfaces.
- Support at least these outcomes:
  - known command with valid context runs the command handler.
  - known command with missing context returns a clear user-facing prompt.
  - unknown slash command returns a concise "command not recognised" response with available
    commands.
  - `/help` returns the available command catalog from command metadata, without depending on a
    specific UI surface.
  - `/help <command>` returns command-specific usage/details from the same registry metadata.
  - syntactically invalid command usage returns the command's usage/help copy.
  - ordinary messages continue through the existing chat/harness path unchanged.
- `/init` must require a selected/open Project folder before it attempts onboarding.
- `/init` must start or resume the existing Project onboarding flow:
  - inspect for existing Project instruction files, especially `AGENTS.md`.
  - draft a complete `AGENTS.md` when missing.
  - propose an update when existing instructions are present.
  - require user review/approval before writing changes.
- Do not silently write `AGENTS.md` from a chat message.
- The same command handler should be callable from a future UI button such as "Onboard Project" or
  "Create Project instructions".
- Command responses should use user-facing language such as "Project instructions" and "Project
  setup"; implementation details like `/workspace`, backend roots, raw state labels, and hashes stay
  out of normal UI copy.
- Preserve existing chat, Project binding, file context, and write-gate behavior.

## Architecture Shape

Preferred implementation shape:

- `application` layer:
  - `SlashCommandParser` port: parses message text into either `not-command` or a command invocation.
  - `SlashCommandRegistry` port: returns command definitions and user-visible metadata.
  - `RunSlashCommand` use case: validates scope/context, dispatches the command, and maps the result
    into the same stream/output contract as chat.
  - `/init` command handler: thin orchestration around existing Project onboarding use cases.
- `infrastructure` layer:
  - default parser implementation.
  - default in-memory/static command registry.
  - adapters for any persistence or filesystem services required by `/init`.
- `interfaces/http` and `apps/web`:
  - adapters only. They detect/forward command invocations but do not contain command business logic.
- future extension:
  - command definitions can later come from plugins, skills, or project-local command files without
    changing the chat route or UI.
  - the built-in registry can be composed with external registries, with deterministic precedence for
    conflicts.
  - commands can declare capability requirements so unavailable commands can be hidden or explained
    cleanly in the UI.

Command result shape should distinguish:

- `handled`: command produced a user-facing assistant response or onboarding state transition.
- `not_command`: continue through ordinary chat.
- `missing_context`: command is valid but needs Project/session context.
- `invalid_usage`: command exists but arguments/options are invalid.
- `unknown_command`: no registered command matches the token.

## Research Notes

Relevant provider patterns to preserve:

- OpenAI Codex CLI exposes `/init` as the command that generates an `AGENTS.md` scaffold in the
  current directory, then expects the user to review and refine it:
  `https://developers.openai.com/codex/cli/slash-commands`.
- OpenAI Codex treats slash commands as session controls exposed from the composer/popup, with
  commands such as `/model`, `/permissions`, `/status`, `/review`, and `/init`. This supports a
  command registry model rather than one-off prompt text.
- GitHub Copilot documents slash commands as shortcuts for common scenarios, with the available
  command list varying by environment/context and discoverable by typing `/`:
  `https://docs.github.com/en/copilot/reference/chat-cheat-sheet`.
- Claude Code supports user/project/plugin-scoped invocable commands/skills with metadata such as
  description, arguments, tool permissions, and user/model invocation controls:
  `https://code.claude.com/docs/en/slash-commands`.
- Cursor supports reusable project commands from `.cursor/commands` and exposes them through `/` in
  chat input, reinforcing that commands should be discoverable and reusable beyond one case:
  `https://docs.cursor.com/en/agent/chat/commands`.

Design implications:

- Parse slash commands before model execution.
- Keep built-in commands deterministic for side effects and state changes.
- Model/prompt-backed commands can exist later, but side-effecting commands such as `/init` need
  product-controlled validation, draft generation, and approval gates.
- The command registry should own command metadata so UI help/autocomplete and server dispatch use
  the same source of truth.
- Model slash-command handling as application use cases backed by interfaces, with HTTP/UI/harness
  integrations acting as adapters. Do not let React components or Express routes become the command
  implementation.
- `/init` should create or update Project instructions through the existing onboarding approval
  lifecycle, not by silently writing from a chat message.
- Command metadata should include at minimum: name, aliases, summary, scope, usage, argument schema or
  validator, and whether the command can create side effects.
- Command registration should be additive and discoverable. Avoid a central `switch`/`if` chain that
  has to be edited for every future command.

## Implementation Plan

1. Locate the earliest stable chat boundary that has access to session, selected Project context, and
   user message text.
2. Define application-layer ports for command parsing, command registry lookup, command execution,
   and command result streaming.
3. Add a default slash-command parser that recognizes a leading command token, arguments, and unknown
   commands without affecting normal messages.
4. Add a command registry with typed command definitions and shared validation/execution contracts.
5. Add the `RunSlashCommand` use case and wire it at the chat boundary before harness/model
   execution.
6. Register `/init` as the first command and route it into the existing Project onboarding use cases.
7. Return command output through the same chat stream shape used by normal assistant responses.
8. Add a small UI affordance only if needed to expose available commands or command errors cleanly.
9. Add tests for parser behavior, dispatch behavior, `/init` context validation, swappable parser/
   registry boundaries, and onboarding handoff.
10. Add Playwright coverage that opens a Project, submits `/init`, reviews the draft flow, and verifies
    no write happens before approval.

## Dependency Order

| Upstream                              | Downstream |
| ------------------------------------- | ---------- |
| `agent-platform-project-onboarding.7` | none       |

## Tests And Verification

- Unit tests for slash-command parsing:
  - `/init`
  - `/init extra words`
  - whitespace before/after commands
  - unknown commands
  - ordinary messages that contain `/init` later in the sentence
- Unit/integration tests for command dispatch:
  - known command runs handler.
  - unknown command bypasses model execution and returns help/error copy.
  - ordinary messages still use the existing harness path.
- `/init` tests:
  - no Project selected returns a clear user-facing prompt.
  - Project selected starts/resumes onboarding without immediate file writes.
  - existing/missing `AGENTS.md` paths reuse the current review/approval flow.
- Playwright:
  - open/select a Project through the UI.
  - submit `/init` in the agent chat.
  - assert onboarding UI/chat draft appears.
  - assert `AGENTS.md` is not written before approval.
  - approve the draft and assert expected file/write-gate outcome.
- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  focused/full Playwright as applicable.
- PR checks, Sonar/Problems gate, and review comments must be green before closing the Bead.

## Definition Of Done

- [ ] Slash-command handling exists as a reusable framework, not a one-off `/init` conditional.
- [ ] Parser, registry, and executor implementations are isolated behind swappable application-layer
      interfaces.
- [ ] New commands can be registered by adding command definitions/handlers without changing parser
      logic or chat route control flow.
- [ ] `/init` is registered as a deterministic Project onboarding command.
- [ ] Unknown slash commands produce clear user-facing feedback without invoking the model.
- [ ] `/help` exposes available commands and command-specific usage from the command registry.
- [ ] Ordinary chat messages remain unchanged.
- [ ] `/init` validates that a Project is selected before onboarding.
- [ ] `/init` starts or resumes the AGENTS.md review/approval flow without silent writes.
- [ ] Future UI CTAs can call the same command handler.
- [ ] Unit/integration tests cover parser, dispatch, and `/init` behavior.
- [ ] Playwright verifies the `/init` onboarding path through the UI.
- [ ] Local gates and PR checks are green before the Beads task is closed.
