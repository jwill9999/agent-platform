# Development lifecycle verification plan

Task: `agent-platform-pilot-zero.17`. Requirements:
[development lifecycle addendum](../planning/standalone-pilot/development-lifecycle-addendum.md).
These are planned checks, not executed evidence. The same task owns the final connected qualification.

| Scenario | Requirements | Setup and action                                                                                    | Required observations                                                                                                                  |
| -------- | ------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| DL-T1    | DL-1, DL-2   | Start with stopped owned services; invoke supported command twice and concurrently                  | One owned service set; authenticated broker issue/revoke and gateway checks; correct readiness; no unrelated resource changes          |
| DL-T2    | DL-1, DL-2   | Docker unavailable, missing image, mismatched service identity, unsafe network, invalid credentials | Launch denied with specific redacted reason and recovery action; no worker starts                                                      |
| DL-T3    | DL-3         | Stop broker during a running disposable worker action                                               | Bounded detection; durable interruption visible while broker remains unavailable; cleanup pending; dependent dispatch blocked          |
| DL-T4    | DL-3, DL-4   | Make cancellation/revocation fail independently                                                     | Original failure retained; both cleanup obligations tracked; no false settled/revoked state; bounded retries                           |
| DL-T5    | DL-4         | Restore broker after an action has written its unique fixture marker                                | Old credential denied; actual effect reconciled; marker count remains one; no automatic repeat; only authorized new attempts permitted |
| DL-T6    | DL-4, DL-5   | Restart coordinator during pending cleanup; run two recovery contenders                             | Pending obligation survives; fenced owner reconciles; stale owner rejected; no lost interruption or duplicate workflow transition      |
| DL-T7    | DL-1, DL-5   | Fail startup after partial provision and repeat; shutdown during work                               | Only owned resources affected; durable identity retained where cleanup is uncertain; repeat is idempotent                              |
| DL-T8    | DL-6         | Run complete stopped → ready → active → broker down → interrupted → restored/reconciled journey     | Real containers, production CLI and persistence used; status/output agrees with DB, credential outcomes and actual file effects        |

Unit checks cover configuration, state transitions, redaction and failure classification. Integration
checks cover durable journal/fencing and production broker protocol. DL-T8 supplies CLI/backend E2E;
no frontend is added in this slice, so browser UI assertions are not its acceptance interface. Existing
hosted browser and desktop suites remain regression gates rather than evidence of broker supervision.

Additional mandatory fault positions for DL-T3–DL-T7:

- Fail the interruption journal write: assert admission stops and no durable-success claim appears.
- Crash after interruption commit and after each external cleanup effect before acknowledgement:
  read back pending records after restart and prove idempotent reconciliation.
- Expire ownership during cleanup: stale writes/dispatch are denied; any already-issued cleanup is
  constrained to the original unique execution, never the replacement worker or service.
- Restart the broker with a new generation; cancel/close a run while cleanup is pending: old tokens
  stay denied, cleanup remains eligible and terminal runs never advance.
- Race worker success with the interruption commit: exactly one governed outcome, no success after
  committed interruption and no dependent dispatch while effects are uncertain.
- Fail each broker listener after the other opens: no partial-ready result or leftover active listener.

The design specifies 2-second health intervals and 3-second timeouts; require detection within 6 seconds
in the controlled test environment (including 1 second scheduling allowance). Assert each cleanup
operation's 5-second timeout, 15-second attempt budget, three attempts and 2-/4-second backoff using
controlled clocks at unit level and bounded wall-clock integration evidence. Exhaustion must remain
visible in persisted status. These bounds are acceptance targets, not measurements already obtained.

Use disposable directories, test journals and separately named Docker services/networks. Keep host
account authentication only in the trusted gateway and out of evidence. Controlled provider responses
may cover fault injection; label them explicitly. Real provider reachability/account validation is a
separate check and must not be inferred from a mocked response. Pin image/source/config identities.

Retain commands, exit status, bounded timestamps, interruption and cleanup records, observed side
effects and permission outcomes in the qualification report. Cleanup only owned disposable resources;
report anything retained for unresolved recovery. Required failures or unrun cases block sign-off.
