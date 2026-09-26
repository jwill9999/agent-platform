# Authorized role-enforcement repair

Owner explicitly requested an audit and repair of filesystem/tool/MCP role enforcement. This is a
separate .17 prerequisite component from credential broker model admission. Supervised bootstrap,
no managed run or pilot; current branch task/standalone-pilot-plan targets feature/harness-backlog-review.
Reuse .17 SP-07/SP-08; do not create a duplicate task or alter approved runtime contracts.

## Requirements and bounded design

- RE-1: enumerate every declared role against its effective source, scratch, tool and MCP access.
  Reject unknown roles and workflow_orchestrator on the specialist launcher; coordinator is privileged
  trusted code, not a general specialist. The role ceiling and bound task operations jointly determine
  execution access; a role name alone cannot grant patch/test/artifact capabilities.
- RE-2: only implementation_worker with workspace.patch may receive writable staged source. All other
  specialists receive read-only source. Authorized test/artifact operations get separate private scratch
  and evidence locations, with read-only source even when running tests. These outputs are untrusted;
  they never automatically import patches or complete tasks.
- RE-3: fresh generated role configuration excludes inherited MCP, apps/plugins, delegation and
  alternate execution tools. Reject unrecognized supplied configuration instead of merging arbitrary
  operator tables. Strip project Codex config/requirements from staged source and hide image user
  configuration. No MCP connection is authorized in this slice; future integrations require explicit
  contract-bound tool/endpoint authorization, not inheritance. No role-policy ceiling is expanded.
- RE-4: roles without patch/test operations receive no permitted shell/patch execution; provide bounded
  staged textual evidence through the prompt so read-only work remains feasible. For test/implementation
  roles, process.test permits sandboxed subprocess execution, not host authority or external credentials.
  Report actual client tool inventories and denied calls separately from configuration declarations.
- RE-5: real-container probes cover every specialist role: source read/edit, scratch/evidence writes,
  immutable config, absent host credentials/control files and no inherited MCP registration. A real
  Codex client against deterministic local model responses verifies role tool exposure and rejected
  malicious calls. Unknown/privileged roles and over-ceiling grants fail before launch. No paid model
  calls are required for these capability probes. Independent source review and package regression gate.

Allowed changes: workflow-control launcher/profile/prompt/config modules and their callers/tests;
linked security/role evidence documentation and session handoff. Broker model admission unchanged.
No UI, staging, merge, automatic startup service or full pilot claim. A test failure keeps the component
open; missing tools cannot be described as runtime proof. Any remaining enforcement limitations must
be stated explicitly in the role matrix and linked .17 record.

## Critique dispositions

The first independent critique identified the existing gaps and clarified the implementation boundary.
Validate role/operation ceilings before staging or issuance. Generate immutable config from typed model
connection inputs rather than merge inherited config. Reserve HOME/CODEX_HOME/PATH and allow no
production environment overrides. Strip .codex/.agents, control directories and all .env variants;
reject explicitly selected symlink components and sensitive paths. Reader evidence is bounded UTF-8
with digests, no silent truncation; unsupported binary/oversize input blocks. Tests use /scratch;
artifact.write alone grants /evidence. /tmp and Codex runtime state are housekeeping, not accepted
artifacts. In-tree build output must be redirected or tests block; never silently give source write.
Offline probes must fail on timeout/nonzero client exit and assert both tool replies and actual file
state. No MCP connection is enabled by this repair; approved remote integrations require a future
explicit endpoint/tool policy. Process.test allows test subprocesses within the containment boundary,
not a promise that arbitrary shell commands can be classified by their intent.

## Implementation refinement

Artifact-only grants expose patch tooling only for the separately writable evidence directory, with
source read-only and no subprocess tool. Test-only roles use scratch as their working directory.
The pinned client requires bubblewrap user namespaces: retain its sandbox and add the bounded Moby
seccomp-derived profile rather than disable either sandbox. Staging UID must match the non-root
worker. Capability identity is copied at issuance. Review evidence must decode UTF-8 strictly.
See [qualification report](../../reviews/role-enforcement-qualification.md) for the declared versus
observed matrix, verification and remaining deployment boundaries.

The pinned client still advertises an apply_patch helper to read-only profiles. Record this catalogue
limitation explicitly: nested execution is disabled, direct patch dispatch is denied by the sandbox,
and source mounts are read-only. No claim of catalogue removal substitutes for those distinct tests.
Patch-only workers also receive source evidence because they have no shell reader. Complete advertised
inventories and direct/nested denial replies are asserted, not just absence of file changes.
