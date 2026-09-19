<!-- Historical research snapshot. Read the bundle README for current scope and Beads authority. -->

# Beads backlog creation: joint review

Beads records are authoritative; this is a read-only presentation of created records and proposed changes. Existing records were not closed, deleted, superseded, reprioritized or given new blocking dependencies.

Created: 2 epics, 21 tasks, 1 review decision (24 records). All 22 proposal labels are mapped: K3 reuses the existing context-optimisation task. Existing parents are reused without replacing them. New epics and later P2 scope are deferred; new P1 implementation tasks are review-gated and unassigned.

## Proposal mapping

| Label | Beads ID                              | Parent / role                                                      |
| ----- | ------------------------------------- | ------------------------------------------------------------------ |
| V1    | `agent-platform-harness-v1`           | agent-platform-llm-observability-export                            |
| V2    | `agent-platform-harness-v2`           | agent-platform-llm-observability-export                            |
| V3    | `agent-platform-harness-v3`           | agent-platform-llm-observability-export                            |
| V4    | `agent-platform-harness-v4`           | agent-platform-llm-observability-export                            |
| V5    | `agent-platform-harness-v5`           | agent-platform-llm-observability-export                            |
| F0    | `agent-platform-harness-f0`           | agent-platform-harness-modernization                               |
| F1    | `agent-platform-harness-f1`           | agent-platform-harness-modernization                               |
| F2    | `agent-platform-harness-f2`           | agent-platform-harness-modernization                               |
| F3    | `agent-platform-harness-f3`           | agent-platform-harness-modernization                               |
| R1    | `agent-platform-harness-r1`           | agent-platform-harness-reliability                                 |
| R2    | `agent-platform-harness-r2`           | agent-platform-harness-reliability                                 |
| R3    | `agent-platform-harness-r3`           | agent-platform-harness-reliability                                 |
| R4    | `agent-platform-harness-r4`           | agent-platform-harness-reliability                                 |
| R5    | `agent-platform-harness-r5`           | agent-platform-harness-reliability                                 |
| K1    | `agent-platform-harness-k1`           | agent-platform-research-tools                                      |
| K2    | `agent-platform-harness-k2`           | agent-platform-research-tools                                      |
| K3    | `agent-platform-context-optimisation` | Existing task retained unchanged; prerequisite refinement proposed |
| K4    | `agent-platform-harness-k4`           | agent-platform-research-tools                                      |
| D1    | `agent-platform-harness-d1`           | agent-platform-agent-profile-governance                            |
| D2    | `agent-platform-harness-d2`           | agent-platform-agent-profile-governance                            |
| B1    | `agent-platform-harness-b1`           | agent-platform-pre-production-automation                           |
| B2    | `agent-platform-harness-b2`           | agent-platform-pre-production-automation                           |

## Unified order and readiness

1. Joint review decision `agent-platform-harness-review-gate` is the only new ready record. It must record the current feature acceptance baseline and which unfinished project-delivery obligations remain holds. Do not equate staging integration with closing pilot-zero, multi-agent.10 or repair.4.
2. Once an implementation tranche is explicitly approved, first candidates are F0 and V1 in parallel; V3 follows V1. F0→F1→F2→F3→R1 determines modernization before V2. V4 fixtures can be prepared after V1, but its final completion waits for V2/V3.
3. Runtime sequence R1→R2→R3 and R4 joins at R5. K1→K2 may proceed in parallel after V1. Retained K3 must receive proposed F3/R1/R4/K2 prerequisites during joint refinement; this is not silently applied to the old task.
4. D1 joins R5/K3/K1, K4 joins K2/K3/V4, and D2 joins D1/K4/V5. B2 validates the combined result. Deferred scope requires explicit activation, not merely an upstream task closing.
5. Old Git sequence 4hm→0ra→5zg→(17h,e6g)→7vf remains. It can be a separate lane if prioritized, but no evidence makes it a prerequisite to the first harness tranche. Preserve macOS .6.3→.6.4 and pre-production→electron-release release gates; external signing does not block local investigation.

Priority expresses urgency, not permission or dependency readiness. Existing broad epics shown ready are not independent executable tasks. The review gate holds reconciliation of old prerequisite changes before allocation.

## Old records: proposed dispositions only

| Existing ID                                    | Proposal                                        | Reason                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `agent-platform-pilot-zero`                    | Retain acceptance/history                       | Project-delivery orchestration and unresolved operational acceptance are distinct from product harness work.                |
| `agent-platform-multi-agent.10`                | Retain acceptance/history                       | Project-delivery orchestration and unresolved operational acceptance are distinct from product harness work.                |
| `agent-platform-pre-production-automation`     | Retain parent                                   | B1/B2 bounded review/integration work does not satisfy all old release criteria.                                            |
| `agent-platform-macos-production-sandbox.6.4`  | Retain release hold                             | Signing/notarization and real artifact evidence cannot be removed by harness replanning.                                    |
| `agent-platform-macos-production-sandbox.6.3`  | Retain release hold                             | Signing/notarization and real artifact evidence cannot be removed by harness replanning.                                    |
| `agent-platform-macos-production-sandbox.6`    | Retain release hold                             | Signing/notarization and real artifact evidence cannot be removed by harness replanning.                                    |
| `agent-platform-macos-production-sandbox`      | Retain release hold                             | Signing/notarization and real artifact evidence cannot be removed by harness replanning.                                    |
| `agent-platform-divergent-pull-merge-resolver` | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-7vf`                           | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-e6g`                           | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-17h`                           | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-5zg`                           | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-0ra`                           | Retain in existing backlog                      | Implementation is recorded; inspect acceptance before repeat work or evidence-backed closure. Existing 4hm blocker remains. |
| `agent-platform-4hm`                           | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-ii1`                           | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-electron-release`              | Retain release hold                             | Signing/notarization and real artifact evidence cannot be removed by harness replanning.                                    |
| `agent-platform-llm-observability-export`      | Retain parent and refine after review           | V1–V5 now decompose agent visibility; broader app diagnostics remain required.                                              |
| `agent-platform-context-optimisation`          | Retain as K3; propose dependency refinement     | Avoid duplicate task; propose F3/R1/R4/K2 blockers and refreshed per-call/cost acceptance.                                  |
| `agent-platform-research-tools`                | Retain parent; review expanded source lifecycle | K1/K2/K4 complement search/fetch. Owner should accept lifecycle boundary; no deletion.                                      |
| `agent-platform-electron-stabilisation.20`     | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-code-workbench.7`              | Propose defer/refine                            | Description rejects full IDE expansion; stored open/ready epic needs reconciliation. No removal applied.                    |
| `agent-platform-code-workbench`                | Propose defer/refine                            | Description rejects full IDE expansion; stored open/ready epic needs reconciliation. No removal applied.                    |
| `agent-platform-agent-profile-governance`      | Retain parent                                   | D1/D2 are bounded product delegation children; broader authoring/governance remains.                                        |
| `agent-platform-skill-authoring`               | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-ui-quality-sensors`            | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-session-handoff-hygiene`       | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-improvement-goals`             | Propose later scope and prerequisites           | Depends conceptually on useful observability and reviewed memory; graph refinement requires review.                         |
| `agent-platform-runtime-backup-auto`           | Retain in existing backlog                      | No evidence warrants deletion or scope replacement; prioritize at joint review.                                             |
| `agent-platform-capability-registry`           | Retain in existing backlog                      | Minimum scopes needed for D1/K1 do not require completing all discovery/install UI; prevent false prerequisite expansion.   |
| `agent-platform-multi-agent`                   | Retain acceptance/history                       | Project-delivery orchestration and unresolved operational acceptance are distinct from product harness work.                |
| `agent-platform-orchestration-toolkit`         | Retain deferred priority intent                 | Packaging/extraction follows project pilot acceptance; not initial product-runtime scope.                                   |
| `agent-platform-multi-agent.repair.4`          | Retain acceptance/history                       | Project-delivery orchestration and unresolved operational acceptance are distinct from product harness work.                |

No old record is proposed for unconditional removal. Any eventual replacement requires explicit mapping, evidence and owner agreement; keep history and specs.

## Verification

All 24 new records reread: dependency/notes/assignment errors = []. New ready IDs: ['agent-platform-harness-review-gate']. Each new task has review-gate blocker. Epic-to-decision edges are unsupported by Beads, so epics are deferred instead. Forward-reference edges omitted on create were reapplied after all records existed and verified. MCP reopen-on-open response defect was avoided by updating notes without status.

Specs are on isolated task/harness-backlog-review, based on feature/harness-backlog-review from staging, preserving the active checkout. Beads spec paths remain docs/tasks/<id>.md; use that branch until reviewed integration. No implementation agent has been assigned.

Publication: specification commit `2e237fa` is pushed on `task/harness-backlog-review`; its base `feature/harness-backlog-review` is also pushed. Neither was merged. Active staging checkout remains unchanged apart from its pre-existing `.beads/interactions.jsonl` modification. New specification formatting, Markdown lint (24 files), and Git whitespace checks passed. No product code changed, so runtime/Sonar code gates are not applicable to this planning-only delivery. Beads remote sync status is reported separately in the completion message.
