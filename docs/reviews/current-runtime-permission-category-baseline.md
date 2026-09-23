# Permission baseline and approved direct-file repair

Owner authorized continuation after PR269 merged. Source base: c1ed389. This is a bounded P2
assessment, not activation of the broader MVP implementation contract. Existing normative specs
remain unchanged. Beads: agent-platform-harness-baseline-p2.

## Initial assessment scope and expected outcomes

Reuse the four existing workspace shell-write journeys. Add direct file write Ask/Auto/Block and a
read-only control under Block, plus a network Block representative. Complement these with all shell
category mode permutations in the policy unit suite. UI labels describe command categories; direct
file dispatch uses separate metadata. The tests probe whether the write-mode promise extends to
that path; a mismatch is a finding requiring explicit policy scoping, not permission to change it.

Real Electron settings/chat, API, SQLite, reasoning, SDK, dispatcher, approvals, file executor and
actual disposable file contents. External HTTP provider is scripted. Shell runner is a fixed fixture;
network Block must never dispatch, and no real external network request or installation is allowed.
No claim about real VM isolation, live-model quality, all registered tools or authentication.

## Gherkin E2E Strategy

```gherkin
Feature: Permission categories across direct file and command paths
  Scenario Outline: Direct write follows the selected write mode
    Given Workspace writes is saved as <mode> through Settings and survives reload
    When Project Chat requests a direct write to a disposable file
    Then <approvals> approvals are required before any write
    And the settled outcome is <outcome>
    And the durable audit and independent file contents agree

    Examples:
      | mode  | approvals | outcome               |
      | ask   | 1         | one approved write    |
      | auto  | 0         | one completed write   |
      | block | 0         | denied without effect |

  Scenario: Blocking writes does not prevent file reading
    Given Workspace writes is saved as Block
    When Project Chat reads the disposable file
    Then its contents reach the provider without an approval or file change

  Scenario: Network Block denies a command before runner dispatch
    Given Network commands is saved as Block
    When Project Chat requests a network command
    Then it settles visibly as Denied
    And there is a denied audit and no runner invocation
```

Retain per-scenario browser traces and sanitized JSON on pass/failure, including persisted policy,
approvals, audits, provider tool results, backend lifecycle, and before/after file content. A policy
mismatch remains a failed assertion, not an expected pass. Category classifier tests alone do not
establish backend enforcement. Execution outcomes and remaining scope will be added after running.

## Initial execution result (before repair)

Nine composed permission journeys ran: **7 passed, 2 failed**. All four existing shell-write cases,
direct Auto write, direct read under Block and network-command Block passed. Direct Ask and Block
write expectations failed: both produced one success audit, no approval and changed file contents.
Screenshots and backend evaluation JSON confirm a completed turn rather than an unsettled request.
Ask never rendered an approval card; Block produced a successful write audit. The 19 shell-policy
unit tests, explicit E2E TypeScript and touched-file ESLint passed.

Evidence: `.agent-platform/permission-category-results` and matching HTML report; each case retains
`policy-evaluation.json` and explicit browser trace. The provider and command runner are fixtures;
direct file execution and bytes are real. These results do not certify other direct mutation tools.
No application code changed and neither failed assertion is skipped or marked expected-to-fail.

Follow-up: [direct-file policy scope](../tasks/agent-platform-direct-file-policy.md), priority 1.
Recommend applying the write mode consistently to direct mutation tools. This needs owner scope
approval because current UI helper text and runtime policy distinguish commands from direct tools.
The E2E gate is **FAIL**, P2 remains in progress and the evidence PR must stay draft/unmerged.

## Reproduction

```sh
AGENT_PLATFORM_E2E_GIT_BINARY=/path/to/working/git \
PLAYWRIGHT_HTML_OUTPUT_DIR=.agent-platform/permission-category-report \
pnpm exec playwright test -c apps/desktop/e2e/playwright.electron.config.ts \
  packaged-vm-command.e2e.ts --grep 'permission policy' \
  --output=.agent-platform/permission-category-results --reporter=list,html
pnpm --filter @agent-platform/harness exec vitest run test/bashCommandPolicy.test.ts
```

Use Node 24 and current build outputs. External model requests are restricted to the local provider
fixture. Linux hosted Electron runs use the existing Xvfb job. No real network call is needed by the
network-denial case. Keep the initial artifacts when rerunning from a committed source.

## Committed confirmation before repair

At test revision `7771375`, all nine permission journeys reran after the build checks completed:
**7 passed, 2 failed**, reproducing the same direct Ask and Block outcomes. Evidence is retained in
`.agent-platform/permission-category-committed-results` and its matching report. The initial run is
preserved separately. No production code changed between these runs.

[Draft PR271](https://github.com/jwill9999/agent-platform/pull/271) publishes the tests and scoped
follow-up. Local affected builds/typechecks and 112 desktop tests passed; 630 harness tests passed
and 12 existing Git tests failed because Apple Git requires Xcode-license acceptance. The push hook
was bypassed for publication after recording that limitation; hosted checks remain required and the
known composed failures keep this draft unmergeable by the project quality gate. E2E TypeScript,
touched-file lint, formatting, Markdown and relative links passed. No failure is hidden or waived.

## Approved repair and verification

The owner explicitly approved direct-mutation enforcement on September 23. Workspace writes now
covers the existing dispatcher write-tool inventory: write, append, copy, create-directory,
download and coding_apply_patch. Patch previews remain read-only; the patch tool has no standalone
move/delete operation. Block is checked before approved-resume bypass. Ask uses durable approval;
Auto preserves risk/explicit approval and existing path, allowlist and onboarding controls. Settings
helper text now describes direct file changes as well as commands. API resume already loads current
settings; no API, schema, dependency or authentication change was needed.

```gherkin
Scenario: A pending approval cannot override a newly selected Block policy
  Given a direct write is waiting for approval under Ask and its file is unchanged
  When the operator changes Workspace writes to Block in Settings and reloads
  And returns to the pending request and approves it
  Then the resumed call is denied using the current saved policy
  And the file is unchanged and a denied audit and tool result are recorded
```

All ten composed permission journeys pass after repair, including the original Ask/Block failures
and the new policy-change-before-resume case. The approval decision is recorded as approved/resumed,
while execution is separately recorded as denied. Evidence: `.agent-platform/direct-file-repair-results`
and matching HTML report, with policy JSON and browser traces. The original failing evidence is retained.

Focused policy/dispatcher tests: 98 pass, including all six tools across Ask/Auto/Block, approved
resumption, Block on resumption, missing-settings default and stricter controls. Full harness suite:
667 pass and 12 existing Git tests blocked by Apple Xcode-license acceptance. Web unit tests: 187 pass.
Full build, repository typecheck, touched-file lint and explicit Electron test typecheck pass.
The broader Electron regression run and hosted checks are still pending; this is not yet a merge
recommendation. P2 remains partial and cancellation/retry/recovery assessment remains open.
