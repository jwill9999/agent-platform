# Specialist role enforcement qualification

## Scope

Owner-authorized repair under `agent-platform-pilot-zero.17`, SP-07/SP-08. This addresses effective
filesystem, client-tool and MCP access independently of the credential broker's model admission.
[Approved scope](../planning/standalone-pilot/role-enforcement-addendum.md). Supervised bootstrap on
`task/standalone-pilot-plan`, PR275 into `feature/harness-backlog-review`; no pilot or staging promotion.

## Declared policy versus effective access

Role declarations are ceilings, not proof of enforcement or provision of every declared service.
The launcher intersects the role ceiling with the bound task operations and rejects unknown roles,
over-ceiling grants and missing source-read authority before staging or credential issuance.

| Role | Declared ceiling | Source | Execution and output |
| --- | --- | --- | --- |
| feature_planner | workspace.read, beads.read, github.read | Read-only | Bounded source evidence; shell and patch execution denied |
| plan_critic | workspace.read, beads.read, github.read | Read-only | Bounded source evidence; shell and patch execution denied |
| repo_explorer | workspace.read, beads.read, github.read | Read-only | Bounded source evidence; shell and patch execution denied |
| code_reviewer | workspace.read, beads.read, git.read, github.read | Read-only | Bounded source evidence; shell and patch execution denied |
| feature_evaluator | workspace.read, beads.read, git.read, github.read | Read-only | Bounded source evidence; shell and patch execution denied |
| implementation_worker | workspace.read, workspace.patch, process.test, artifact.write | Writable only with workspace.patch | Shell only with process.test; separate scratch/evidence grants |
| test_runner | workspace.read, process.test, artifact.write, github.read | Read-only | Tests in /scratch, evidence in /evidence |
| qa_evaluator | workspace.read, process.test, artifact.write, github.read | Read-only | Tests in /scratch, evidence in /evidence |
| workflow_orchestrator | Privileged coordination policy | No specialist launch | Rejected; trusted coordinator/broker code remains separate |

All specialist MCP catalogues are empty. No endpoint is authorized by this component; inherited
project/user config, plugins, applications, browsers and child-agent tools are disabled. Future MCP
use requires explicit contract-bound endpoint/tool approval and further qualification. The model
provider URL is an explicit typed input, separate from MCP and execution authority.

Beads/Git/GitHub reads in the policy table do not imply live tools are connected. This component
supplies selected source text with content hashes; any additional required evidence must be supplied
by the coordinator. Live remote-reader workflows have not been demonstrated by this repair.

## Technical boundary

Source is a private staged copy restricted to approved paths. Read-only bind mounts prevent reviewer
and test-role edits even when Unix file modes would permit them. Test and artifact grants control
separate mounts. Test roles work from /scratch; artifact-only work uses /evidence. In-tree build outputs
must be redirected; the launcher never silently makes source writable for tests. Outputs are untrusted
and do not import changes or complete tasks automatically. /tmp and Codex home are runtime housekeeping,
not accepted evidence destinations. Production staging ownership must match the selected non-root UID;
incompatible/root-coordinator deployments fail closed until a supported ownership path is provided.

Configuration and auth files are immutable mounts. The launcher generates configuration rather than
merging arbitrary supplied tables, rejects production environment overrides, removes .codex/.agents,
.env variants and control directories, and rejects explicitly selected symlink paths. Read-only roles
receive bounded UTF-8 evidence; binary, malformed or oversized input is rejected instead of truncated.
Capability issuance snapshots process identity as well as operation/path arrays. Malformed mixed path
arguments fail closed. Patch-only workers receive bounded source evidence before editing existing files.
The pinned client advertises apply_patch even for read-only roles: its nested host is disabled and
direct patch dispatch is rejected by the read-only sandbox. Complete advertised inventories, tool
rejections and filesystem denials are recorded separately; catalogue removal is not claimed.

The container retains non-root execution, read-only root, no-new-privileges, dropped capabilities,
resource limits and no host/control mounts. Codex's filesystem and no-network subprocess sandbox
remains enabled. Docker's default seccomp blocked bubblewrap namespace creation in the tested image.
A vendored, pinned Moby default profile adds unprivileged-user-namespace clone and the namespace/mount
syscalls required by bubblewrap; host namespace operations still require absent capabilities. No
SYS_ADMIN, privileged mode, unconfined seccomp or danger-full-access is used in delivered launches.
The upstream profile and Apache-2.0 notice are retained in specialistSeccomp.ts and MOBY-LICENSE.

`process.test` allows contained subprocess execution; it is not a command-intent classifier. The
launcher still relies on the separately qualified model gateway/private network for client egress.
These tests do not establish whole-deployment network topology or immunity to a compromised kernel,
client image, Docker administrator or trusted coordinator.

## Evidence and review

Qualification uses pinned image
`sha256:e71bd7931f0cbfb4f5887ce5109f0b25095f3e8329b1656bf7ebed73efeb877f`,
Codex CLI0.156.1, Node24.21.0, Linux arm64 kernel7.0.12-linuxkit. Requalify changes to these components.
The filesystem suite exercises all eight specialists plus four reduced implementer grants, with an
additional production-permissions case that does not chmod staging. Client probes use real Codex and
real tools against deterministic local Responses data; no paid model or real worker credentials.
They distinguish completed model turns, natural client exit, tool denials and actual filesystem effects.

Independent critique identified staging-UID mismatch, probe exit handling, mutable process identity
and invalid UTF-8 handling; regression coverage accompanies the corrections. Final results and
follow-up review are pending and must be recorded before sign-off. The single-task orchestration
pilot and broader .17 acceptance remain open.
