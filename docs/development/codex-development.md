# Native Codex developer workflow

## Agree once, execute through acceptance

Agree requirements, definition of done and meaningful tests up front. An owner-authorized task
covers planning, implementation, routine refinements, test fixes, repairs/retries, independent QA
and review, Git/Beads/documentation work and CI evaluation until the concrete final owner check.
Reuse that authorization across phase boundaries. File selection and ordinary subtask decisions
are implementation details. Clarify when evidence reveals a real change to the owner's intent,
agreed behavior/delivery, reserved action or missing required input.

Read current source and Beads; preserve dirty work. Plan a feasible task/dependency/test map and
obtain an independent source-aware critique for substantive plans. Resolve actionable findings;
within end-to-end authorization continue to implementation without renewed routine approval.
Use native tools with actual Codex platform permissions. No custom workflow database, version1
execution contract, exact-document approval persistence, sandboxed launcher, gateway, aggregate
budget or admission qualification is required for ordinary developer tickets.

## Roles, checks and delivery

Repository agent profiles supply responsibilities and inherit actual session defaults, including
available concurrency and sandbox. They are not technical permission controls. Independent reviewers
can inspect source and tests with native tools; read-only responsibility prohibits mutation of the
reviewed work but does not imply absent tools. Delegate with clear ownership and preserve others' edits.

Use Beads for task state and ordinary native Git/MCP/CLI paths for authorized delivery. Preserve
repository branch chaining, meaningful security/regression checks, relevant connected product QA,
full Notion documentation mirrors/readback, and exact-head CI evidence. Fix failures within scope,
record limits, and return the tested diff for final owner acceptance. Merge/release authority is
separate and must be actually granted; green CI alone grants none.

## Product and prototype boundary

Agent Platform runtime security stays intact: user permission levels, approval routes/contracts,
PathJail, tool/network guards, dispatch/reasoning checks and encrypted secrets are product behavior.
Developer autonomy does not change those controls or weaken their denied-effect tests.

The repository `packages/workflow-control` prototype is PAUSED. Its executable authorization,
isolation, broker, approval, recovery and budget guards remain unchanged. Its docs describe that
explicit prototype only; they do not gate native developer work. Do not start/resume its pilot or
old automations from historical handoffs. It remains in normal recursive workspace gates.

## Adoption and global guidance

This branch changes repository guidance only. After owner acceptance and ordinary reviewed
integration, open a fresh Codex session on the integrated branch; existing sessions may retain loaded
instructions/defaults. Observe actual tools and behavior rather than inferring platform settings from
prompts. Never overwrite a dirty checkout to adopt instructions.

Global config, installed skills, memories, child runtime state and connector settings stay unchanged.
[Exact global proposals](../planning/codex-developer-autonomy/global-follow-ups.md) await owner discussion.
Current owner authorization takes precedence over stale guidance without granting platform permissions.
[ADR-0005](../adr/0005-native-codex-development.md) supersedes ADR0004's default developer route.
