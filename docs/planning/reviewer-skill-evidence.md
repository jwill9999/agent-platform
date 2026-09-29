# Reviewer skill evidence repair

Owner approved this narrow repair, ten non-launch decision scenarios and subsequent single-task pilot
planning on 29 September after PR279 merged. This is supervised prerequisite implementation under
`agent-platform-pilot-zero.12`; no managed workflow, merge, staging or pilot launch is authorized.
Canonical Beads: `/Users/letuscode/projects/agent-platform`. Worktree: the existing
`agent-platform-workflow-evaluation`; branch `task/reviewer-skill-evidence`, chained from
`task/standalone-readiness` and incorporating feature merge `43157a8c`. Destination:
`feature/harness-backlog-review`.

## Requirements and boundary

- RE1: The trusted review coordinator can explicitly select a repository-local
  `.agents/skills/<skill-name>/SKILL.md` regular UTF-8 file from the pinned repository HEAD commit as review evidence. No directory selection,
  references/scripts, arbitrary `.agents` configuration, symlink, escape or credential directories.
- RE2: Stage skill bytes as inert evidence outside `.agents`, with original source identity and
  content digest retained. Bind the original-to-staged mapping in the material manifest. Do not let
  Codex discover the selected text as an installed skill, MCP configuration or active instruction file.
- RE3: Ordinary worker snapshot restrictions are unchanged, including rejection of `.agents` paths.
  Reviewer source/config mounts remain read-only (generated runtime home stays writable), tools/MCP/delegation disabled, fixed model-only egress.
- RE4: Failed staging cleans private material. Malformed, missing, oversized or symlinked skill input
  fails before authentication/model execution. The source checkout is never modified.
- RE5: Run the ten retained scenarios through the repaired restricted reviewer, retain inputs,
  manifest and outputs, and assess each result. This proves bounded decision behavior only.

Allowed implementation: `packages/workflow-control/src/supervisedReview.ts`, a dedicated review
snapshot helper if needed, associated unit/integration tests and these qualification/handoff docs.
Do not widen `prepareSpecialistWorkspace` permissions, change managed role policy, inherit MCP access,
change credentials, perform product/backend repairs or launch the pilot.

## Design

Keep ordinary evidence handling on the existing worker-safe copy path. For exact skill selections,
resolve and pin repository HEAD once using the trusted Git executable. Verify the repository root,
require an exact regular-file tree entry, check blob size, and read the immutable blob by object ID.
Deny all Git transports and lazy object fetching; missing local objects fail closed, regardless of repository transport configuration. Bind that source commit in the manifest. Never open skill content from the live working tree;
changing an ancestor to a symlink cannot redirect an immutable object read. Statically detected
working-tree symlinks remain rejected. Uncommitted skill edits are excluded explicitly: commit the
intended skill revision first, or stop and explain that the proposed text is not covered.

Stage validated bytes under a reserved inert namespace with SHA-256-derived source-path names.
Include staged location, original path, source revision and content digest in the material manifest.
Validate UTF-8/NUL and the aggregate 2 MB text limit before accessing/copying model authentication.
Reject directory/namespace collisions, oversized blobs and invalid paths. For skill-only evidence,
allocate an empty private workspace/home with the existing auth placeholder; never copy `.agents`.
Ordinary workers retain the same denial. No general worker copier permission is added.

Effective source/config mounts are read-only. The generated runtime home remains writable for Codex
runtime state; it has no inherited MCP/skills. Verify the final role configuration and real container
access, not merely the configuration initially written by snapshot preparation. Prompt evidence is
data, never executable instructions. Existing execution timeout semantics are not redesigned here:
use 300 seconds per create/start subprocess, 2 MB output and a separate 10-second cleanup allowance.

## Verification and completion

Unit cases: skill-only and mixed selection, deterministic binding, changed-content digest, original
source unchanged, no staged `.agents`, unsafe paths/directories/references, symlinked ancestors and
files, malformed/oversized text, cleanup and ordinary worker denial. Include a real-container probe
that reads approved skill bytes and cannot edit them or discover a source `.agents` directory; retain
existing reviewer capability restrictions. Build, typecheck, lint, focused and full workflow-control
regressions plus independent code/evidence review are required. Browser/product E2E has no new UI path;
hosted repository checks remain integration gates.

Run the ten cases in the [retained scenario input](../reviews/evidence/standalone-readiness/scenarios.txt)
using the owner's previously authorized existing Codex account and qualified restricted gateway.
No new model provider, paid API credential or benchmark. Use the per-subprocess bounds above; at most three repair/review iterations before reporting unresolved findings.

Publish findings and exact evidence, update Beads/session, mirror substantive docs to Notion and push
for feature review. Do not close segment-tip tasks before required integration. Then draft `.13`'s
exact task/verification/contract material for independent critique and owner review; this is not
permission to launch it or to claim the wider skill/runtime system fully proven.
