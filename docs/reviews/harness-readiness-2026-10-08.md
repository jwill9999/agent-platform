# Harness readiness reconciliation — 8 October 2026

Status: assessed, blocked before pilot execution. Existing Beads tasks: `agent-platform-pilot-zero.12`
and `agent-platform-pilot-zero.17`; pilot plan `.13` remains blocked. Source integration:
`f8112b142ecad7d8fa5963484a0ed28235b04c3b`. Branch: `task/harness-readiness-reconciliation`.

## Initial checkpoint evidence

PR280 reviewer repair and PR282 cleanup are merged into the harness feature. PR281 documentation
is delivered to staging. Prior source/CI evidence remains historical evidence; this assessment does
not rerun the 1,140-test serial or 20-container suite and does not claim a managed execution cycle.
Live Beads `.10`, `.11`, `.12`, `.17` remain in progress. `.12` can report a blocked assessment but
must reconcile its upstream skill acceptance/evidence before closing. S2–S10 retained decision cases
pass their bounded scenarios; S1 safely stopped but did not establish configured admission/scheduling.

Docker initially failed to connect. Docker Desktop was opened; the read-only daemon query then
reported server 29.8.0. No managed workflow service or model generation was started.

The existing private operator configuration was inspected without displaying credentials or account
paths. Both pinned images are available. Its optional `workflow` field is absent, so this operator
configuration has no pilot phase runtime attached.

- Broker image: `sha256:7f8671d5961c4f9957057fa4f2d1d537266de30102f1234f6ec9771f7c265ea2`.
- Worker image: `sha256:e71bd7931f0cbfb4f5887ce5109f0b25095f3e8329b1656bf7ebed73efeb877f`.

## Actual worker image probe

An ephemeral container used the configured worker image with `--network none`, `--read-only`,
no source/credential mounts and a `/bin/sh` entrypoint. It was removed on exit. No Codex/model
process, broker credential or pilot run was created. The probe ran `node --version`, looked up
`pnpm`, `electron`, `Xvfb`, `chromium` and `git` on PATH, and checked `/workspace/node_modules`.
Observed output:

```text
v24.21.0
no-preinstalled-workspace-dependencies
```

Exit status: 0. None of the five executable lookups returned a path. This establishes their absence
from this image's PATH, not absence of every possible executable elsewhere. It does not demonstrate
an application build or Electron launch. The reviewer image recipe installs Node/Codex, not the
application-test environment. Existing source snapshot construction excludes `node_modules`.

## Initial checkpoint dispositions

| Requirement | Disposition | Evidence and remaining work |
| --- | --- | --- |
| Reviewer skill evidence | Integrated | PR280 retains inert skill evidence and ordinary-worker restrictions. |
| Docker daemon and pinned images | Available now | Local offline probe; not perpetual host health. |
| Managed application test environment | Blocked | Configured worker lacks required PATH tools/dependencies; no qualified provisioned replacement or scratch-build route. |
| Configured admission and initial scheduling | Unproven | S1 gap retained; operator has no workflow field. No run admission was attempted. |
| Role/coordinator policy and phase acceptance | Unbound for this pilot | Existing implementation/fixture qualification must be bound to actual emitted packets, configuration and phases. |
| Execution ceilings | Unqualified for proposed ceilings | Runtime derives an attempt deadline from waitDeadlineSeconds; proposed ten-minute attempts and sixty-minute aggregate require explicit supported mapping. |
| Canonical discovery and approval | Not refreshed in this checkpoint | Earlier binding evidence retained; no absence/approval claim is made from direct config inspection. |

## Original bounded qualification proposal

Prepare a managed test-environment qualification plan under `.17` using the repository's current
frozen lockfile and CI installation/build steps as source evidence. It should establish:

1. An immutable test-capable image with Node24, pinned pnpm, Git, Linux Electron/Xvfb libraries and
   repository dependency provisioning; record image/manifest/lockfile hashes. Do not inherit host deps.
2. Offline use of dependencies at execution time. Any package/network provisioning happens in the
   separately qualified image build, not through broadening specialist model egress or credentials.
3. Read-only governed source, an explicitly permitted build copy in scratch, and report writes only
   to approved evidence locations. Verify snapshot digest unchanged after build/tests.
4. A real backend test and existing connected Electron control journey in that environment, including
   result return and forbidden source-write checks. Do not implement P4.1 during this prerequisite check.
5. Compatibility with installed role/tool policy. A Docker-shell probe alone is not evidence that an
   isolated test runner can execute those commands through its actual permitted tools.

The current CI uses frozen-lockfile installation, native dependency rebuilds, Playwright Linux system
libraries, and Xvfb for desktop E2E. Those steps are evidence to reuse, not proof the isolated worker
already has the same environment. Resolve image provisioning/scratch-build design before changing
operator workflow configuration. If a runtime change is necessary, prepare its bounded repair and
review rather than silently weakening source permissions or adding a new watchdog.

After test-environment feasibility: qualify exact guarded admission/initial scheduling, phase-specific
acceptance, coordinator return/delivery, role policy and enforceable ceilings. Refresh canonical
read-only discovery, then finalize/review `.13` and obtain persisted owner approval before a live pilot.

## Initial checkpoint verification boundary

Source inspection, live Beads reads, Docker daemon/image queries and the offline ephemeral image
probe were executed. No credentials copied, live model calls, managed phase launches, package installs,
runtime code changes, pilot test implementation or protected merges occurred. Markdown/relative-link
checks apply to this report. `.12`, `.17`, `.13` and P4.1 remain open; runtime readiness is blocked.

## Runner qualification iteration

A supervised prerequisite plan is recorded in
[runner qualification](../planning/single-task-permission-pilot/runner-qualification.md).
Independent critique approved bounded environment feasibility after copy/control-selector corrections.
This is not a pilot execution-contract approval.

The disposable multi-stage test image built from the pinned worker and frozen dependency manifests.
Candidate image ID: `sha256:90dd34f0f6c35fd108d0beec015802a392124d74b106009777bcdef5a1c1ede9`.
Node24, pnpm9.15.4, Git and Xvfb are available; native dependencies and Electron were provisioned.
The final stage excludes repository application source, Git, skills, private configuration and build
helper scripts. Provisioning dependencies is separate from specialist execution network access.
The first build invocation failed resolving a bare local image ID; the corrected local base tag was
verified against the original immutable image ID before the successful second build.

Offline feasibility attempts 1 and 2 failed at dependency relocation: GNU cp attempted directory
permission changes rejected by Docker shared storage. Neither reached backend or Electron controls.
Both logs are retained. Plan revision 2 explicitly grants two additional bounded attempts using a
hash-verifying Node copier without directory mode/ownership writes. Runtime restrictions remain
read-only source/root, no network, dropped capabilities, no-new-privileges, original seccomp,
4GiB memory, four CPUs, 256 PIDs and noexec container tmpfs.

Evidence remains in the operator's disposable runner-qualification-20261008 directory: build input
and source manifests, image inspection, both build logs and all offline attempt logs. No successful
application test or actual Codex role-path qualification is claimed by the image build alone.

Existing runtime derives specialist deadlines from waitDeadlineSeconds (300 seconds for this plan),
and records scoped retry counters. An enforced sixty-minute aggregate active-run ceiling has not
been identified. The owner was asked in Slack and this chat whether to retain that requirement with
a bounded repair or revise scope to supported limits. That decision and configured admission,
coordinator bindings, role-path qualification and exact final approval remain outstanding.

### Executed control results and retained failures

Attempt 3 verified 38,624 regular-file copies and 2,603 relocated links, built the application and
passed all 79 backend permission tests. Electron selected zero tests; this was not a pass.
Attempt 4 selected the exact one-test approve/provider-http journey, but its teardown required Git
HEAD in the Git-free governed snapshot and could mask an earlier failure. A reviewed test-only repair
supports a strict forty-hex source-revision override, labelled declared snapshot base; actual patched
file hashes are recorded separately, so this does not claim snapshot equality with the base commit.

Attempt 5 exposed Git's ownership guard during disposable fixture setup. A bounded diagnostic found
Docker initially reported its newly created fixture root as UID0 and .git as UID501. Command-local
safe.directory for only the exact newly created fixture fixed setup; no global or governed-source
exception was introduced. Attempt 6 then passed build, 79 backend controls, modified-file ESLint and
desktop type checking, but its single Electron journey failed at backend readiness. It generated no
provider requests, approvals or tool audits. Do not increase its timeout or report successful launch.
Revision 4 scopes bounded startup-output/log capture before any further repair.

The separate real Codex test-runner probe used the generated launcher/policy and existing deterministic
offline Responses fixture. Nine requests completed; permitted process/scratch/artifact effects passed.
Source patching, protected config/auth/root writes, Docker socket/network, MCP and agent spawning
were denied. Generated policy, original and fixture-entrypoint launch arguments, results and cleanup
are retained. The first cleanup checker conservatively retained staging because Docker's lowercase
absence response did not match; exact container absence was verified, staging removed and the corrected
probe repeated successfully. This qualifies that tool boundary, not the production model gateway,
managed application execution, admission or coordinator acceptance. No paid model call occurred.
All 828 governed-source hashes remained unchanged during each completed control attempt.

### Independent skill acceptance reconciliation

The independent read-only reconciliation found `.10` and `.11` satisfy their bounded skill-delivery
criteria: discoverable skills, retained schema/procedural validation, corrected committed-input
scenario evidence and merged PR280. See [readiness refresh](orchestration-readiness-refresh-2026-09-26.md)
and [reviewer evidence qualification](reviewer-skill-evidence-qualification.md).
S1 remains a safe stop, not configured admission/scheduling; S2–S10 support their assessed outcomes.
Historical review-outstanding notes are superseded by those reviews and the merged delivery.
`.12` can complete its assessment with this blocked readiness verdict after upstream reconciliation;
`.13` explicitly remains blocked by `.17`; the prior `.16` delivery gate is closed. No assessment closure removes those launch gates.

### Final outcome of this qualification slice

Attempt 7's bounded startup diagnostics identified a missing tracked OpenAPI contract in the supervised
snapshot. It was restored from the recorded base; attempt 8 passed build, all 79 backend controls,
modified-file lint, desktop and explicit E2E type checking, and exactly one Electron control with no
retries/skips. All 829 source-file hashes remained unchanged. No application runtime fix was needed.

Actual Codex application-tool attempt 1 used generated test_runner policy, fixed command/session
fixture responses and the production launcher. Build, 79 backend controls and static checks passed,
but Electron failed with listen EPERM on 127.0.0.1. Under the generated test-runner policy, the selected fixture failed binding 127.0.0.1 with EPERM.
All 832 staged source/helper hashes were unchanged and owned-container absence/evidence retention
were verified before cleanup. A repeated identical attempt would not resolve this policy blocker.
See [public evidence summary](evidence/runner-qualification-2026-10-08/summary.json); complete logs,
transcripts and generated policy/arguments are retained in the operator qualification directory.

The image therefore has direct-container feasibility, but managed application-tool qualification
remains blocked. The [local-test route proposal](../tasks/agent-platform-test-runner-loopback.md)
gates .17 and .13. Resolve the reviewed route/permission scope before implementation; unchanged strict
worker networking is still effective. The separate sixty-minute aggregate-ceiling choice remains
pending. Configured admission/scheduling, production gateway/coordinator bindings and exact pilot
approval remain unexercised. No pilot, paid model call, permission widening or protected merge occurred.

Initial .10/.11 closure was refused by the open skills-gate; no override was used. The live dependency
chain was then independently reconciled against integrated .8/.9 assessments and the recorded
September24 bounded skill decision. .8, .9, skills-gate, .10 and .11 closed in dependency order.
.12 retains its blocked assessment pending latest publication/integration; .17
and .13 remain in progress with the new local-test repair gate open. Assessment closure never grants
pilot launch authority.
