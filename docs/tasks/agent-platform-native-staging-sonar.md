# Task: Repair delivered baseline Sonar findings

**Beads:** `agent-platform-native-staging-sonar`; parent `agent-platform-native-staging-integration`.

**Version:** 1, 11 October 2026. Owner-authorized bounded prerequisite repair.

**Branch:** `task/native-staging-sonar-repair` from actual full feature `4cf29b18`;
task PR targets `feature/harness-backlog-review`, then existing PR286 targets protected staging.

## Problem and boundary

PR298 delivered the reviewed combined tree `dbbd092b` to the feature at `4cf29b18` after all nine
executed feature checks passed. Actual PR286 Sonar analysis at that head reports a green quality
gate but two Critical complexity and two Major nested-ternary findings in promoted code. The repository
completion rule separately blocks unresolved Critical findings in touched files. Passing CI alone is
insufficient. Actual latest ordinary full Promptfoo run `38105914455` succeeded on this head;
the corrected source still requires its own new-head protected scan, actual VM and all other gates.

This repairs already delivered foundation and test support. It does not resume paused PR283, alter
prototype authority, launch a model run, change security policy, dependencies, archive payloads or
the six protected controls. Independent source triage approved the bounded corrections below;
implementation review and actual new-head hosted qualification remain mandatory. Owner routine
repair and guarded merge authority is retained; no renewed phase approval is needed.

## Requirements

| ID  | Behavior and preservation                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NS1 | Remove `supervisedReview.ts` Critical complexity and Major nested ternary by extracting lexical/component/canonical-path validation and explicit UTF-16 manifest comparison. Preserve exact errors, rejection order, symlink/skill/text limits, deterministic digest, sequential filesystem operations and cleanup.                                              |
| NS2 | Remove `providerJourney.ts` Critical callback complexity by extracting the bounded HTTP body reader and accepted-request/resume validator. Preserve route checks, 250,000-character bound, fail-first handling before accepted validation, attempt/request mutation order, custom tools, split SSE arguments, resume identity, finish frames and error handling. |
| NS3 | Remove `provider-network-guard.cjs` Major nested ternary using explicit string/URL/Request branches. Preserve the exact IPv4/localhost/IPv6 allowlist and original fetch input/init/result; deny remote and lookalike hosts.                                                                                                                                     |
| NS4 | Meaningful regression effects, affected package quality/tests, independent source review, normal hooks, full specification/session mirrors and current-head feature checks pass. Verify the actual repair reaches PR286 source and fresh detailed Sonar has no Critical/Major findings in repaired files before child closure/readback/sync.                     |
| NS5 | Preserve all archive/control/source/paused and dirty work. Parent remains in progress until actual final-head full scan, signed packaged VM, all live protections/reviews, final stage tree/preservation/readbacks/sync and guarded delivered-branch cleanup are complete.                                                                                       |

## Findings, minor dispositions and tests

Independent triage identified `NI-QUALITY-01`/`02` as Critical cognitive complexity, and
`NI-QUALITY-03`/`04` as Major nested ternaries. No new exploit is established by these quality findings.
Do not use `localeCompare`: it can change material identities. Do not suppress reports, weaken rules,
parallelize ordered work or replace real provider parsing with a success stub.

The other 37 Minor reports remain disclosed and source-backed: 34 await-in-loop reports describe
ordered cumulative traversal/copying, network transitions, journal recovery and monitoring waits;
an explicit regex-match rejection precedes indexed identity access; the async default admission
callback fulfills a Promise contract; separate Docker installation layers preserve construction/cache
boundaries. These are retained behavior and have no demonstrated defect requiring this repair.
Their reports are not dismissed or silently called resolved. Actual hosted findings must be refreshed.

| Scenario    | Requirements | Evidence and effect                                                                                                                                                                                                                                                     |
| ----------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NS-SNAPSHOT | NS1, NS4     | Existing supervised-review and committed-skill tests plus UTF-16 ordering/input-order-independent digest regression; forbidden paths, symlink ancestors, immutable skill/text and cleanup rejection behavior retained.                                                  |
| NS-PROVIDER | NS2, NS4     | Actual loopback HTTP requests verify split SSE tool arguments, final completion/usage, retry recording, custom tools, route/model/stream/count/tool/resume denial, malformed and oversized bodies, independent recorded attempts/errors. No paid provider is contacted. |
| NS-NETWORK  | NS3, NS4     | Static child code exercises string/URL/Request loopback forms and remote/lookalike denial; a local fetch recorder verifies original arguments/result without external requests.                                                                                         |
| NS-QUALITY  | NS1-NS4      | Affected build/typecheck/lint/format/tests, exact source hashes, independent review, normal hooks and latest hosted detailed Sonar clearance. IDE Problems unavailable is disclosed; actual Sonar/CodeQL still required.                                                |
| NS-DELIVERY | NS4, NS5     | Full two-document readbacks, exact-head feature PR merge/tree proof, actual PR286 repaired source/detailed finding clearance, canonical child readback/Dolt; new full protected scan/VM/reviews belong to parent acceptance.                                            |

## Execution and definition of done

### Actual local evidence

Independent plan and seven-file implementation reviews approved the scoped repair without findings.
The real HTTP/network regression suite passed all 11 cases; the affected workflow package passed
1,141 tests with 77 existing optional integration skips. A command intended to select two files passed
a literal `--` through the script and selected the complete workflow suite; the retained log reports
that actual full coverage. Independent review additionally exercised six boundary regressions.
Affected package typecheck/lint passed. An extra provider-source typecheck initially ran from the
monorepo root, which lacks that package's Node type declarations; the unchanged source passed when
checked from the desktop package with its installed Node types. Both attempts are retained.
Formatting/direct Markdown, normal hooks, complete mirrors and exact-head hosted qualification still
gate publication and delivery; these local results do not clear the old hosted Critical findings.

### Remaining delivery

The first reviewed repair was published in PR299 at `58d3399a`; normal hooks passed 124 desktop
and 1,141 workflow tests, and both complete specification/session mirrors were read back. Its fresh
Sonar quality check is green, but detailed analysis reports a Blocker `S2699`: assertions embedded
in the network-guard child program are not visible to the parent test analyzer. The follow-up retains
those child assertions and returns the actual forwarded/denied counts for an explicit parent assertion.
All 11 HTTP/network cases passed again. The relocated sequential path-validation await is one
disclosed Minor report; ordering remains intentional. The follow-up needs independent source review,
normal publication/mirror refresh and fresh hosted clearance; old-head success cannot qualify it.

1. **Completed:** independent source-backed triage and requirement/scenario critique approved.
2. **Completed:** bounded extraction/comparison repairs, HTTP/snapshot/network regressions,
   affected package typecheck/lint and complete workflow tests passed; implementation review approved.
   Failed or unexpectedly selected check invocations remain disclosed above and in retained logs.
3. Verify final source/preservation, commit/push through normal hooks and read back complete
   source-bound specification/session Notion mirrors. Re-review changed semantics if source changes.
4. Wait for every executed/required latest feature check and actionable review to clear; guarded merge
   into the existing feature. Verify tree and actual PR286 source, then fresh detailed Sonar clearance.
5. Read back upstream state and close/sync this child only after NS1-NS4 delivery. Parent and final
   staging acceptance remain pending until NS5's protected and cleanup gates actually complete.

No upstream implementation task remains open for this bounded repair; parent integration waits on it
through a canonical Beads blocks edge. Linked [parent specification](agent-platform-native-staging-integration.md)
and [session](../../session.md) retain full source history and final merge/cleanup authority.
Documentation and source review are not proof of later hosted completion or staging readiness.
