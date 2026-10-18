# Dependency security maintenance

Owner authorized Dependabot, GitHub's Dependency Review Action and remediation with regression
tests and independent critique on 17 October 2026. The SDK upgrade remains separate. No merge,
main promotion, paid provider request, Docker gateway activation or paused orchestration is included.

## Source and delivery

Canonical task: `agent-platform-dependency-security`; [specification](../tasks/agent-platform-dependency-security.md).
Feature `feature/dependency-security` and task `task/dependency-security` start at staged
`d55f20ed034ec79ebe60af3a2f734699fe7ba264`. Worktree:
`/Users/letuscode/.codex/worktrees/openai-parameter-repair/agent-platform`.
Migration PR345 and hook repair PR348 are now delivered through protected PR347 at staging
`5c2f6553b1169abc0fa4fcd53432b2207f538313`. The task locally merged that independently qualified
source with reviewed checkpoint`6f622ac6` at`b6e3b614`; the feature baseline is refreshed and both branches are pushed. Draft PR350 targets that feature;
local combined qualification passed, while connected and hosted qualification remain in progress. Preserve dependency repairs and both complete session histories through exact
unique-prefix/common-body reconstruction, rather than duplicating their shared historical body.

## Bounded stages

1. Enable dependency graph/alerts/security updates in GitHub settings; verify actual API access.
   Owner enabled settings; API comparison200 and enabled security updates are now verified.
2. Add SHA-pinned official Dependency Review Action on PRs into feature/staging/main, with read-only
   permissions, no PR comments or package execution, and failure for introduced high/critical
   advisories in runtime, development and unknown scopes. Missing dependency graph or failed scanning
   must fail, not become a clean result. Record the exact required-check/ruleset binding separately:
   an installed failing check is not an enforced merge gate until that binding is active.
   The pinned vendor can proceed after snapshot warnings. A small read-only completeness guard must
   validate the same exact-ref paginated GitHub comparison after the vendor, reject warnings/auth/
   malformed or missing data, and compare the vendor's complete `dependency-changes` output with
   that guarded inventory. Normalize only the pinned vendor schema/defaults; retain all advisory
   metadata, omitted-scope distinctions and duplicate counts. The guard retains source/ref/inventory
   provenance and does not implement vulnerability matching. Transport complete output through bounded
   private files, using the runner Node shell and a standalone JSON string literal rather than bulk
   environment values. Actual reverse-ancestor API comparison was empty under merge-base semantics;
   the negative fallback runs the verified unmodified official bundle against deterministic API fixtures
   and records the live negative graph gap. Missing or oversized action output
   fails unqualified; no truncation or filtered-inventory fallback is permitted.
3. Configure weekly pnpm/npm and GitHub Action update proposals, with limited concurrency and no
   automatic merge. Owner explicitly selected `staging` as default, now verified via API. Config and
   scheduled workflows activate only after protected staging delivery. The separate
   `agent-platform-dependency-security-activation` task records real settings/check activation;
   no main promotion or separate main policy merge is required.
4. Triage exact staged lockfile findings. Apply compatible patch/minor repairs first, then reviewed
   test-tool/database/native upgrades when required by an advisory. Record baseline versus final
   unique advisories and instances separately. Do not use blanket audit fixes, suppressions or an
   arbitrary transitive major override. AI SDK/provider upgrades stay on their separate P1.
5. Run affected regressions, obtain independent final review, push and open task-to-feature PR.
   New source requires actual hosted checks. Final acceptance and merging remain separate.

Dependabot proposals target development `staging`, now the default branch. Adopt approved
changes through the normal task/feature delivery route rather than merging bot proposals directly.
Their restricted secrets must not be copied or bypassed to run privileged checks. The target-branch
option applies to version updates only; security update PRs follow the default branch. This initially
targeted main, but the owner's explicit default change corrected that. PR346 has retargeted to staging.
Continue full staging lockfile audits; differential PR checks do not clear existing debt.

The SDK freeze includes `ai`, every `@ai-sdk/*` package and their resolved provider protocol versions.
Record their exact lockfile versions before and after each batch. Do not override those families to
make the security audit pass. Their findings belong to `agent-platform-provider-interoperability`.

## Remediation groups

| Group                         | Initial source-backed candidates                                                                                                     | Regression boundary                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Compatible web/native/network | Next15.5.28, Electron42.11.15, MCP SDK1.32.1; compatible transitive fixes selected from actual parent ranges                         | Browser/chat/Stop, native startup/Electron, MCP discovery/approval, diagnostics              |
| Test tooling                  | Vitest4.1.12 with explicit Vite7.3.7 replaces vulnerable2.1.9; version-matched worker/config migration and full regressions required | Full existing tests, mock semantics, worker isolation, benchmarks and hooks                  |
| Database/media/tracing        | Drizzle requires0.45.2+, Sharp0.35.5, LangSmith0.6+; no compatible parent upgrade established yet                                    | Migration/data preservation, image processing, disabled/enabled tracing and no secret export |
| Upstream/no fix               | Braces advisory reports no patched version; assess real consuming paths and supported parent replacement                             | No invented patch or blanket ignore; explicit evidence and remaining ownership               |
| SDK                           | Existing AI/provider advisories remain separate                                                                                      | Coordinated SDK plan; no custom parameter or protocol rewrites here                          |

These are selected candidates. Compatible package/lock drafts have been resolved and installed with
lifecycle scripts disabled; they are not yet regression-qualified. Reviewed root overrides and Drizzle0.45.4/Kit0.31.11 are resolved; DB191 tests and the production
workspace build passed. Four parent-pin exceptions and stricter-runner regression findings remain
explicit in the results; final regression, connected and hosted qualification is still required. Split a batch when its API or runtime surface
changes materially; security authorization does not relax evidence or preservation requirements.

## Maintenance and limits

The weekly `review-agent-platform-dependencies` heartbeat is active and reviews actual staging,
deduplicates Beads findings and reports meaningful changes. It supplies recurring review while new
GitHub configuration has not yet reached protected staging. It does not install upgrades or merge.
Dependency review checks additions against the PR base; it does not certify the existing tree clean.
Existing source/security and browser/Electron gates remain in place. An audit's severity is not proof
of exploitability: retain environment/precondition evidence and upstream gaps. A separate reviewed
SDK task may own an unresolved advisory, but this security task must disclose it before acceptance.

Files and data in paused worktrees/branches, owner app profiles/credentials and unrelated checkouts
remain unchanged. The owner separately approved bounded test-only changes to this task's copies of
`bootstrap.test.ts` and `storage.test.ts`: final13 bootstrap composite budgets at30seconds,24 at5seconds;
nine storage cases with60second fixture leases and cleanup, retaining explicit short-expiry and
takeover checks and all other20 storage cases. These exceptions do not authorize paused runtime,
PR283, global timeout/retry changes or orchestration resumption. See results for source and behavior evidence.

See [verification](../testing/dependency-security.md) and [results](../reviews/dependency-security-results.md).
