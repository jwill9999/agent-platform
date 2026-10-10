# Native staging remedies — execution manifest

The owner approved the reviewed APFS runner setup and narrow archive scanner policy on
11 October 2026, and authorized scoped blocker repairs and protected staging merges after
actual checks and actionable review findings clear. Native developer authority applies.
Paused orchestration remains retained separately; no main promotion or next priority selection.

| Task                        | Beads / canonical spec                                                                                                  | Delivery                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| APFS runner and actual VM   | `agent-platform-native-staging-runner`; [runner spec](../tasks/agent-platform-native-staging-runner.md)                 | Fresh APFS dev host plus scoped authored packaging/CI repair in policy segment                      |
| Trusted archive policy      | `agent-platform-native-staging-archive-policy`; [policy spec](../tasks/agent-platform-native-staging-archive-policy.md) | `task/native-staging-archive-policy` → `feature/native-staging-security-policy` → protected staging |
| Historical artifact staging | Existing `agent-platform-native-staging-evidence`                                                                       | PR288 after authored bookkeeping separately fully scanned and exact archive-only qualification      |
| Complete native baseline    | Existing `agent-platform-native-staging-integration`                                                                    | PR286, refreshed/rehearsed against qualified staging, ordinary actual full scan and VM              |

Segment base: `a5a1641c3d2a5ef317c05fa45c6190e7189c1915`. No original artifact bytes are
added by the policy adoption segment. Preserve 220 original archive files from `6ca3cd1b`,
3,958,506 bytes, and every original feature/session history. PR283, budget/adapter checkpoints,
dirty primary and paused worktrees remain outside integration and cleanup.

The distinct source-aware plan critic approved version 1 archive-policy design and scoped CI
concurrency repair without actionable findings. The automatic check plus independent protected
dispatch/verifier is a mandatory operational trust boundary; existing context matching alone
does not enforce workflow provenance. Implementation review and actual connected qualification
are still required. No review, scan or VM outcome is manufactured.

Verification: [scenario plan](../testing/native-staging-remedies.md).
Actual results: [review and results](../reviews/native-staging-remedies.md).
Next product priority remains undecided, for a live Beads backlog review after consolidation.
