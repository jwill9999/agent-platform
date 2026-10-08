# Managed application test environment qualification

Status: executed supervised qualification, blocked at actual role local HTTP access; prerequisite slice under existing `agent-platform-pilot-zero.17`. Owner authorized
continued actions until pilot-ready on 8 October. This does not authorize the live pilot, a paid model
call, relaxed permissions, dependency upgrades or staging delivery. Source: f8112b14 plus readiness report.

## Requirements and acceptance

RQ1: Build a disposable immutable Linux-arm64 test image from the existing pinned Node24/Codex worker,
with package-manager version9.15.4 from packageManager, Git, native build tools, Electron Linux libraries
and Xvfb. Provision locked dependencies only; record source/lockfile/image digests.
RQ2: Bake dependency trees and package manifests only. Do not bake repository implementation, skills,
Git history, private configuration or credentials into the image. Native helper scripts used during
build are removed from final image. No host node_modules mounted.
RQ3: Run with read-only image/root/source, dropped capabilities, no-new-privileges, current specialist
seccomp, 4GiB memory,4CPU,256pids and no-exec512MiB /tmp. The offline shell probe writes only scratch/evidence; launcher-equivalent checks additionally retain
the existing private /codex-home writable mount with generated configuration read-only. Network disabled
for offline feasibility probes; later existing role-gateway qualification remains distinct.
RQ4: Copy permitted source to scratch and add qualified dependency trees using matching manifest/lock
digests; preserve workspace-relative dependency symlinks. Build and run real backend/Electron controls
offline. Verify original source hashes unchanged; include denied source-write control.
RQ5: Repeat the command path under generated test_runner policy/working-directory constraints without
claiming a live-model-to-tool journey from a direct-shell probe. Any role-policy/browser-sandbox blocker
is recorded, not bypassed with privileges or egress.

## Scope and checks

Create build context outside the checkout from committed files only. New tracked artifacts: this plan,
runner qualification report/evidence and current session. Existing application code, lockfile, runtime
policy and operator configuration unchanged. Image build may access official package repositories for
locked package installation; execution-time worker networking remains offline/model-gateway-only.
No journal migration, run admission, credentials, live generation or P4.1 implementation.

Use CI frozen-lockfile/ignore-scripts provisioning, native dependency rebuild and checked Electron
installer. At execution, copy source excluding Git, skills, environment/private configuration and
node_modules; write build outputs to scratch. Backend control: existing toolDispatch permission tests.
Electron control: a bounded existing provider/approval journey supported on Linux using its existing
fixture transport. No real API billing or product mutations outside disposable fixtures.

Maximum two build/feasibility attempts before recording a blocking finding; each build/test process
has a45-minute wall-clock cap and disposable container cleanup. Retain first failure evidence. Do not
change runtime caps based on a failing probe. New source or lockfile changes invalidate qualification.

## Completion boundary

Independent plan/source review and image/boundary/control evidence required. An offline container
pass qualifies environment feasibility only. The installed role-policy/gateway path, admission/scheduling,
coordinator bindings, approved documents and execution ceilings remain subsequent prerequisites.
Any necessary runtime repair needs its own bounded plan/review; final exact pilot approval is separate.

## Independent critique corrections

Copy the complete root dependency store plus every root/workspace node_modules tree and bin links,
retaining their relative workspace layout. After relocation, reject unresolved workspace links or
links back into /opt/qualified-deps; build workspace dependencies before tests.
Use a separate final Docker stage so provisioning scripts/caches are absent from final layers. Record
base/platform, every manifest/helper digest, resulting image ID, installed dpkg package versions, and
resolved Electron/native dependency versions. Inspect final image for forbidden source/private files.

Backend command after recursive package build: `pnpm --filter @agent-platform/harness exec vitest run
test/toolDispatch.test.ts`; require nonzero tests and zero failures. Electron: build backend, renderer
and desktop as CI does; run `xvfb-run -a pnpm exec playwright test -c
apps/desktop/e2e/playwright.electron.config.ts apps/desktop/e2e/packaged-vm-command.e2e.ts
--grep '^Project Chat disposable edit: approve with backend evidence \(provider-http\)$'`.
Require exactly one executed test and original file/approval/audit/provider assertions passing.
Set process-local TMPDIR, XDG_CACHE_HOME and evidence/report paths within scratch/evidence, leaving
container /tmp noexec unchanged. These are qualified test commands, not production launcher env overrides.
Codex HOME and generated config remain as the launcher defines for later role-path checks.
Zero selected tests, retries, sandbox failures or skipped controls are not qualification success.

## Revision 2 — dependency relocation correction

The original two feasibility attempts failed before controls at GNU cp directory mode writes on
Docker shared storage. Preserve both logs; neither attempt qualifies tests. This revision permits
two additional feasibility attempts under identical runtime restrictions. Copy into fresh private
scratch using lstat, rejecting devices, sockets, FIFOs and unknown entry types. Copy regular files
exclusively and verify every SHA256; preserve executable bits on files only. Preserve literal links
and reject dangling or escaping resolved targets before builds. Permit overlapping manifest files
only when byte-identical; directories must remain real directories. Never traverse destination links.
Retain logs outside reset scratch; verify original governed-source hashes after controls.

## Revision 3 — Git-free evidence provenance repair

Attempt 3 built successfully and passed 79 backend permission tests but selected zero Electron tests
because Playwright prefixes the file in its full title. Attempt 4 selected one test and failed when
its finally evidence recorder required git rev-parse in a Git-free governed snapshot. This failure
may mask an earlier journey failure; do not infer that the journey passed.

Bounded repair ownership: apps/desktop/e2e/packaged-vm-command.e2e.ts only. Accept an optional
AGENT_PLATFORM_E2E_SOURCE_REVISION containing exactly forty hexadecimal characters; otherwise retain
Git HEAD lookup for normal checkouts. Validate/resolve once before tests; use that value at both
existing evidence sites. The supervised qualification supplies the actual source revision and
retains per-file source digests including this test-only patch. Do not mount Git or manufacture a
repository history. Two further control attempts maximum; retain all earlier evidence. Run applicable
lint/type checks and require one executed Electron pass with existing assertions, no retries/skips.
This does not change application policy, the specialist launcher, production operator config or pilot
approval. Source/evidence bindings must account for the test patch before qualification acceptance.

Revision 3 diagnostic: the fresh disposable fixture directory is temporarily reported as UID0 by
Docker shared storage while its .git is UID501. Git status identifies dubious ownership; a later
mount reports UID501. A command-scoped safe.directory equal to that newly created fixture directory
restores Git config without capabilities or global configuration. Apply that exact-path option to
the fixture's initialization/config/add/commit commands only. Never trust all directories or the
governed source. This fits the remaining sixth control attempt; earlier failures remain retained.

## Revision 4 — capture the failed startup before further repair

Attempt 6 passed build, 79 backend controls, modified-file ESLint and desktop type checking, but its
single Electron control failed waiting twenty seconds for backend health. Provider requests, approval
and audit effects were absent. Actual Codex test-runner fixture assertions and owned-container cleanup
passed separately; this does not qualify the production gateway or Electron backend.

Before proposing a startup fix, add bounded stdout/stderr capture from the disposable Electron
process and attach existing fixture backend/renderer logs before fixture cleanup. Scope remains the
same E2E file; record absent logs and truncate each captured stream at 64KiB. Do not print private
operator configuration, widen limits, disable Electron sandboxing or alter assertions. Two diagnostic
control attempts maximum under unchanged runtime restrictions; retain attempts 1–6 and patched-file
provenance. A discovered runtime repair requires its own reviewed bounded scope.

Attempt 7 diagnostics identified omitted tracked contracts/openapi/agent-platform.yaml in the
supervised source allowlist; the API requires it during startup. Add that one tracked regular file
from the recorded base revision, retain its digest and all forbidden-path filters, then use the
remaining eighth attempt. This corrects snapshot preparation, not application runtime behavior.

## Revision 5 — run application controls through the actual Codex tools

Attempt 8 passed build, 79 backend controls, lint, desktop and explicit E2E type checking, and exactly
one Electron journey with no retries/skips. All 829 snapshot files remained unchanged. The configured
role fixture also passed allowed/denied assertions and verified owned-container cleanup.

Next bounded scope: disposable offline Responses fixture drives the real pinned Codex test_runner
client to invoke the application-control shell script through functions.exec/exec_command and poll
only its returned session through write_stdin. Use the existing production launcher/generated policy,
network none, empty fixture authentication and the candidate image. Stage the hashed source plus
qualification helpers as read-only permitted fixture input, not credentials or host dependencies.
The shell writes only scratch/evidence, leaves Codex config unchanged, and uses process-local temp/cache
settings. Preserve generated arguments/config, fixture-entrypoint substitution and control results.
Two attempts maximum, four-minute fixture deadline and five-minute owned-container supervisor bound;
verify cleanup before deleting staging. Require actual tool completion code zero, 79 backend passes,
one Electron pass and unchanged source hashes. This proves offline tool-route feasibility, not real
production gateway authentication, initial scheduling, coordinator acceptance or pilot authority.
