<!-- Historical research snapshot. Read the bundle README for current scope and Beads authority. -->

# Harness research review scorecard

This scorecard evaluates the analysis, not production readiness or implementation approval.

| Question                                                              | Evidence required                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Are runtime, framework, harness and product governance distinguished? | Explicit ownership and integration boundaries; no competing lifecycle authorities                       |
| Are recommendations TypeScript-specific?                              | Verified current JS/TS API support and a compatibility plan for installed versions                      |
| Is existing functionality credited?                                   | Source pointers for memory, approvals, retry, sandboxing, tests and workflow-control                    |
| Are missing code and missing evidence distinguished?                  | Each gap classified as confirmed, partial, evidence-only or deployment-conditional                      |
| Is production scope proportionate?                                    | Local/single-user baseline separated from hosted/multi-user requirements                                |
| Is orchestration operationally complete?                              | Child lifecycle, permissions, context, budgets, artifacts, cancellation, recovery and result acceptance |
| Are framework claims falsifiable?                                     | Compare code removed after adapters, completed real tasks, latency, usage and failure behavior          |
| Does the sequence handle dependencies?                                | Credential/state separation before durable checkpoints; lifecycle contract before frontend SDK choice   |

Candidate successful journey: a user selects a configured coordinator, submits bounded work, observes specialist progress and artifacts, reviews a requested operation, and receives a verified result.

Candidate recovery journey: interrupt a worker around a side effect, restart, reconcile its actual outcome, resume the correct run, and retain truthful parent/child UI status without repeating the action.

No tests executed for this research review. Framework changes and runtime guarantees require a later isolated prototype and release evidence.
