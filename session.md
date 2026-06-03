# Session handoff

**Purpose:** short rolling handoff for the next agent or developer. Keep this file current, concise, and actionable.

## Maintenance Rules

- Maximum target length: 160 lines.
- Keep only the current state, the last 3-5 meaningful iterations, and the next prioritized actions.
- Archive older detail before adding new detail. Current archive: [session-archive-2026-05.md](session-archive-2026-05.md).
- Do not paste long logs, full PR histories, or old task narratives here. Link to GitHub PRs, Beads tasks, docs, or archive entries instead.
- Each session update should replace stale content, not append indefinitely.

## Last Updated

- **Date:** 2026-06-04
- **Session:** Fixed SonarCloud review comments on the packaged macOS VM staging gate.
- **Branch:** `jwill9999/macos-production-sandbox-vm-lifecycle-exec`
- **Latest commit:** `e5ca3a1` fixes SonarCloud review comments on PR #227.

## Current State

- Production sandbox work remains on `jwill9999/macos-production-sandbox-vm-lifecycle-exec`; do not push directly to `main`.
- The macOS VM production path is Apple `Virtualization.framework` with `VZLinuxBootLoader` and a raw ARM64 Linux `Image`.
- Docker and host command runners remain development-only paths; production/staging must prove `macos-vm` or stay fail-closed.
- `.4.2`, `.4.2.1`, `.4.2.2`, `.4.2.3`, `.4.3`, `.4.4`, `.4`, `.5.1`, and `.5.2` are complete.
- `.5.3` is complete and pushed.
- `.5` / `.5.4` are on hold: implementation reaches real VM startup, but final staging sign-off
  requires a self-hosted VM-capable Apple Silicon runner labelled `self-hosted`, `macOS`, `ARM64`,
  and `agent-platform-vm`.
- `.6.1` is in progress: production resource/network/filesystem/user policy hardening is
  implemented locally, but live VM smoke evidence is still required before closing.
- `.6.2` is in progress: safe VM runtime repair is implemented locally and covered by desktop unit
  tests; signed/packaged smoke evidence can be added later with the self-hosted runner.
- `.6.3` is in progress: packaged helper signing/quarantine/entitlement verification is implemented
  locally; signed/notarized artifact smoke evidence is still required before closing.
- `.6.4` is in progress: Windows/Linux adapter boundaries and the epic closure audit are drafted;
  final closure remains blocked by `.5`, `.5.4`, `.6.1`, `.6.2`, and `.6.3`.

## Recent Work

- Completed `.5.1` through `.5.3`: packaged helper/assets, fail-closed startup/health behavior,
  and packaged Electron E2E coverage for ready and unavailable VM command flows.
- Cleared PR #227 verify/Sonar followups, including harness browser startup budget, remaining
  Sonar issue, fixed security hotspots, and duplicated-test setup.
- Started `.5.4` staging gate work:
  - added a staging-only `staging-packaged-macos-vm-e2e` CI job on `macos-15`,
  - made the job require `AGENT_PLATFORM_MACOS_VM_ASSET_ARCHIVE_URL` and
    `AGENT_PLATFORM_MACOS_VM_ASSET_ARCHIVE_SHA256`,
  - packages the signed helper with downloaded pinned assets and uploads manifest/evidence
    artifacts,
  - extended the packaged Electron E2E so CI can run the success path against real packaged
    resources while retaining synthetic fail-closed coverage.
- Investigated the three failing PR #227 checks:
  - `verify` failed in `packages/harness/test/browserTools.integration.test.ts` because first
    Chromium startup exceeded the 30s tool timeout on GitHub; increased the integration startup
    budget while keeping action timeouts bounded,
  - SonarCloud reported one open issue, `typescript:S3358`, in `apps/web/app/page.tsx`; extracted
    the command-runner status color ternary into a named helper,
  - `staging-packaged-macos-vm-e2e` failed because the required pinned asset URL/SHA repository
    variables were empty, not because of test code.
- After the asset variables were configured, `staging-packaged-macos-vm-e2e` downloaded and verified
  the pinned archive, then failed real VM startup on GitHub-hosted `macos-15-arm64` with
  `VZErrorDomain` code `2`: `Virtualization is not available on this hardware`.
- Updated `.5.4` CI wiring to require a self-hosted Apple Silicon runner labelled `self-hosted`,
  `macOS`, `ARM64`, and `agent-platform-vm`; hosted macOS is no longer treated as a valid staging
  runner for the production VM gate.
- Put `.5` and `.5.4` on hold in Beads and claimed `.6.1`.
- Implemented `.6.1` policy hardening:
  - exported shared macOS VM production policy details from the harness,
  - clamped macOS VM command timeout/output limits in the TypeScript adapter and native helper,
  - documented the production policy: 2 vCPU, 2048 MiB RAM, disabled guest networking, non-root
    `agentplatform` user, `/workspace` as the only host-backed writable mount, and app-owned guest
    scratch,
  - added policy details to command-runner health,
  - added native diagnostics for network device count and effective production policy,
  - hardened the guest service to clamp job limits and set non-root HOME/TMPDIR scratch.
- Implemented `.6.2` safe VM repair flow:
  - added desktop maintenance IPC/preload action `repairMacosVmRuntime`,
  - validates runtime path ownership under desktop app data and refuses Project/arbitrary/symlink
    paths,
  - stops a running VM daemon via the packaged helper before deleting state,
  - deletes only VM `state` and `images` by default, preserves diagnostics logs, and recopies
    packaged pinned assets,
  - added desktop tests for stopped/running/corrupt runtime repair and unsafe path refusal.
- Started `.6.3` signing/notarization validation:
  - added `native:vm:verify-signing` for packaged helper verification,
  - verifier fails closed for missing/non-executable/quarantined/unsigned helpers and missing
    `com.apple.security.virtualization`,
  - staging packaged VM workflow now stores `helper-signing-report.json` before running the VM E2E,
  - full signed/notarized artifact smoke remains pending the VM-capable Apple Silicon runner.
- Started `.6.4` final documentation/audit:
  - added `docs/design/command-runner-platform-adapters.md`,
  - documented Windows and Linux as future `CommandRunner` adapters, not host-shell fallbacks,
  - added `.6.4` Beads/traceability audit showing exactly which VM evidence tasks still block epic
    closure.
- Added self-hosted runner preflight support for `.5.4`:
  - added `native:vm:host-check`,
  - checks macOS, `arm64`, minimum macOS major, Virtualization.framework, hypervisor support,
    `xcode-select`, Swift, and `codesign`,
  - staging workflow now runs the preflight after install before downloading/publishing VM assets.
- Fixed the next self-hosted runner failure:
  - `native:vm:verify-signing -- --runtime-dir ... --json` failed with `Unknown argument: --`,
  - updated `verify-macos-vm-signing.mjs` to strip pnpm's forwarded separator,
  - added regression coverage in `macosVmSigning.test.ts`.
- Fixed the next staging runner issues:
  - the VM asset archive is now cached locally on the self-hosted runner by SHA and verified before
    reuse,
  - the signing verifier now accepts compact `codesign` entitlement XML using `<true />`, avoiding a
    false missing-entitlement failure when the helper is correctly signed.
- Investigated the next self-hosted staging failure:
  - `staging-packaged-macos-vm-e2e` now reaches Playwright but both stories fail while running the
    desktop DB seed subprocess,
  - local synthetic packaged VM E2E passes, so the fixture path is valid,
  - hardened `seedDesktopDatabase` in `packaged-vm-command.e2e.ts` to create the DB parent directory
    explicitly and include seed script path, SQLite path, exit status, stdout, and stderr on failure.
- Fixed the revealed self-hosted seed failure:
  - the runner reported `SQLITE_READONLY_DBMOVED` while migrating the E2E SQLite DB under the
    checkout on `/Volumes/external/...`,
  - moved the packaged VM E2E fixture temp root to `os.tmpdir()` via `mkdtempSync`, keeping runtime
    SQLite and VM state out of the GitHub Actions worktree/external checkout volume.
- Fixed the next real-VM assertion failure:
  - the real VM completed the tool call but did not emit the synthetic helper marker
    `VM_CWD:/workspace` because the command was `pwd`,
  - changed the scripted tool command to read-only `env` and made the assertion accept either the
    synthetic marker or real VM `PWD=/workspace`, avoiding unrelated Project onboarding approval
    state.
- Fixed the SonarQube security hotspot blocking the quality gate:
  - gate failure was `new_security_hotspots_reviewed` at `98.6`, not `new_security_rating` (which
    was `A`),
  - unreviewed hotspot was `.github/workflows/promptfoo-code-scan.yml:28`
    `githubactions:S7637` for `promptfoo/code-scan-action@v0`,
  - pinned `promptfoo/code-scan-action` and `actions/checkout` in that workflow to full commit
    SHAs.
- Fixed the next SonarCloud review comments on PR #227:
  - reduced `verify-macos-vm-signing.mjs` parser complexity by extracting forwarded-separator,
    option-value, and path-option helpers,
  - replaced the packaged VM E2E hard-coded token-looking value with a non-secret host-only canary,
  - replaced repeated `Array#push()` calls in `check-macos-vm-runner-host.mjs` with a single
    precomputed checks array.

## Checks Run

- `pnpm --filter @agent-platform/harness test -- test/browserTools.integration.test.ts`
- `pnpm --filter @agent-platform/harness test`
- `pnpm --filter @agent-platform/harness typecheck`
- `pnpm --filter @agent-platform/harness lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test`
- `pnpm --filter @agent-platform/api test`
- `pnpm --filter @agent-platform/api test -- test/readinessCheck.test.ts`
- `pnpm --filter @agent-platform/api typecheck`
- `pnpm --filter @agent-platform/api lint`
- `pnpm --filter @agent-platform/desktop test -- test/backendSupervisor.test.ts`
- `pnpm --filter @agent-platform/desktop test -- test/macosVmPackaging.test.ts test/packageScripts.test.ts`
- `pnpm --filter @agent-platform/api run typecheck`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/desktop run typecheck`
- `pnpm --filter @agent-platform/api run lint`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/desktop run lint`
- `pnpm --filter @agent-platform/api run build`
- `pnpm --filter @agent-platform/web run build`
- `pnpm --filter @agent-platform/desktop run build`
- `pnpm --filter @agent-platform/api run test`
- `pnpm --filter @agent-platform/desktop run test`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm --filter @agent-platform/desktop exec playwright test -c e2e/playwright.electron.config.ts e2e/packaged-vm-command.e2e.ts`
- `pnpm run format:check`
- `pnpm docs:lint`
- `pnpm --filter @agent-platform/harness test -- test/browserTools.integration.test.ts`
- `pnpm --filter @agent-platform/harness run typecheck`
- `pnpm --filter @agent-platform/harness run lint`
- `pnpm --filter @agent-platform/harness test -- test/macosVmCommandRunner.test.ts test/commandRunnerHealth.test.ts`
- `pnpm --filter @agent-platform/harness typecheck`
- `pnpm --filter @agent-platform/harness lint`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/web run lint`
- `swift test --package-path apps/desktop/native/macos-vm-runner`
- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts test/macosVmPackaging.test.ts`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test -- test/backendSupervisor.test.ts test/preloadContract.test.ts test/localDataReset.test.ts`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts test/macosVmSigning.test.ts test/macosVmPackaging.test.ts`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm format:check`
- `pnpm docs:lint`
- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts test/macosVmHostCheck.test.ts`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop test -- test/macosVmSigning.test.ts test/packageScripts.test.ts`
- `pnpm --filter @agent-platform/desktop native:vm:verify-signing -- --runtime-dir /tmp/nonexistent --json`
- `pnpm --filter @agent-platform/desktop test -- test/macosVmSigning.test.ts test/packageScripts.test.ts`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop native:vm:build` (passed outside sandbox after Swift cache
  write was blocked inside sandbox)
- `pnpm --filter @agent-platform/desktop native:vm:sign-dev`
- `pnpm --filter @agent-platform/desktop native:vm:verify-signing -- --helper /Users/letuscode/projects/agent-platform/apps/desktop/native/macos-vm-runner/.build/arm64-apple-macosx/debug/macos-vm-runner --json`
- `pnpm --filter @agent-platform/desktop test` (passed outside sandbox after localhost binding was
  blocked inside sandbox)
- `pnpm format:check`
- `pnpm docs:lint`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/packaged-vm-command.e2e.ts` (failed
  inside sandbox because localhost binding is blocked)
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/packaged-vm-command.e2e.ts` (passed
  outside sandbox)
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/packaged-vm-command.e2e.ts` (passed
  outside sandbox after moving fixture temp root to `os.tmpdir()`)
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/packaged-vm-command.e2e.ts` (passed
  outside sandbox after aligning real VM output assertions)
- `sonar api get '/api/qualitygates/project_status?projectKey=jwill9999_agent-platform'`
- `sonar api get '/api/hotspots/search?projectKey=jwill9999_agent-platform&status=TO_REVIEW&ps=100'`
- `sonar verify --file .github/workflows/promptfoo-code-scan.yml --project jwill9999_agent-platform`
  (blocked: organization has not enabled SonarQube Agentic Analysis)
- `git diff --check`
- `pnpm --filter @agent-platform/desktop test -- test/macosVmSigning.test.ts test/macosVmHostCheck.test.ts`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm format:check`
- `pnpm docs:lint`
- `git diff --check`
- Pre-push hook: `pnpm --filter @agent-platform/desktop build`, `typecheck`, and full desktop
  `test` suite.
- GitHub PR #227 after CI setup fix: `verify`, `docker`, `desktop-e2e`, `e2e`, `security-scan`,
  CodeQL, markdownlint, lychee, and SonarCloud passed before the local `.5.2` changes.

## Next

1. Commit and push the SonarCloud review-comment fixes, then rerun SonarCloud/quality gate.
2. If the self-hosted packaged VM job stays green, record passing evidence in `.5.4`.
3. Keep `.5`, `.5.4`, `.6.1`, `.6.2`, `.6.3`, `.6.4`, `.6`, and
   the epic open until artifacts prove real packaged `macos-vm` command execution, policy behavior,
   repair, signed/notarized helper execution, and final traceability closure.
