# Harness readiness reconciliation — 8 October 2026

Status: assessed, blocked before pilot execution. Existing Beads tasks: `agent-platform-pilot-zero.12`
and `agent-platform-pilot-zero.17`; pilot plan `.13` remains blocked. Source integration:
`f8112b142ecad7d8fa5963484a0ed28235b04c3b`. Branch: `task/harness-readiness-reconciliation`.

## Current evidence

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

## Readiness dispositions

| Requirement | Disposition | Evidence and remaining work |
| --- | --- | --- |
| Reviewer skill evidence | Integrated | PR280 retains inert skill evidence and ordinary-worker restrictions. |
| Docker daemon and pinned images | Available now | Local offline probe; not perpetual host health. |
| Managed application test environment | Blocked | Configured worker lacks required PATH tools/dependencies; no qualified provisioned replacement or scratch-build route. |
| Configured admission and initial scheduling | Unproven | S1 gap retained; operator has no workflow field. No run admission was attempted. |
| Role/coordinator policy and phase acceptance | Unbound for this pilot | Existing implementation/fixture qualification must be bound to actual emitted packets, configuration and phases. |
| Execution ceilings | Unqualified for proposed ceilings | Runtime derives an attempt deadline from waitDeadlineSeconds; proposed ten-minute attempts and sixty-minute aggregate require explicit supported mapping. |
| Canonical discovery and approval | Not refreshed in this checkpoint | Earlier binding evidence retained; no absence/approval claim is made from direct config inspection. |

## Next bounded qualification slice

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

## Verification boundary

Source inspection, live Beads reads, Docker daemon/image queries and the offline ephemeral image
probe were executed. No credentials copied, live model calls, managed phase launches, package installs,
runtime code changes, pilot test implementation or protected merges occurred. Markdown/relative-link
checks apply to this report. `.12`, `.17`, `.13` and P4.1 remain open; runtime readiness is blocked.
