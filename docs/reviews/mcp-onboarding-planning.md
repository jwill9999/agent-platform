# MCP onboarding planning review and results

**Status:** source investigation complete; independent critique approved; awaiting owner scope agreement.  
**Task:** `agent-platform-mcp-onboarding`. **Source baseline:** `26e90126a1987b1dc6e689438b471fe5ed932235`.  
**Plan:** [Bounded MCP onboarding](../planning/mcp-onboarding-mvp.md).  
**Verification:** [V01–V09](../testing/mcp-onboarding-mvp.md).

## Actual investigation

Inspected current import/editor, shared contracts, registry/mappers, encrypted secret store, API test route, adapter transport/session/manager, harness factory/trust guard/tool dispatch and existing tests. Confirmed `http` mismatch, ignored env/headers, plaintext metadata exposure risk, discovery versus eligibility difference, and host-process execution boundary. Existing mocks do not establish end-to-end onboarding.

Read versioned MCP SDK1.29.0 stdio/Streamable HTTP sources and current upstream Everything documentation. No dependency upgrade or third-party server installation was performed. Docker engine29.8.0 responded; dev macOS runner was online/idle during planning. This is feasibility evidence, not a running app stack or executed product test.

Read live Beads parent and historical related records, created one P1 owning task and kept its status in progress. No cross-task blockers were fabricated. Planning authority permits docs/Beads/publication; owner expressly reserved scope agreement before implementation. No runtime code changed and V01–V09 remain not run.

## Independent critique

Independent `runner_plan_critic` inspected the actual draft and relevant source under the plan-critique skill. Initial verdict: correction required. The corrected plan and verification map were independently rechecked; final verdict **approved**, with no actionable findings. All four dispositions below are resolved.

| Finding | Severity | Correction and verification                                                                                                                                                                  |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCP-C01 | High     | MCP-06 binds pending approval to configuration and tool-schema revision, rejects stale/missing binding; V04 checks endpoint/command/credential/schema substitution and unassignment/deletion |
| MCP-C02 | High     | MCP-07 halts automatic turn continuation after ambiguous post-dispatch outcome; V06 uses a model attempting a duplicate call and asserts exactly one effect                                  |
| MCP-C03 | High     | MCP-04 sanitizes legacy credential-bearing URLs on public paths and blocks activation pending explicit replacement; V03 adds URL canaries                                                    |
| MCP-C04 | Medium   | MCP-04 distinguishes structural key validation from authenticated decryption; V03 wrong-key test uses existing ciphertext                                                                    |

All four corrections remain within the proposed connection safety boundary. No runtime implementation or product test was performed. A review assignment is procedurally read-only; it does not technically remove inherited tool access. Independent approval does not imply owner acceptance.

## Planning quality and publication

Direct Markdown validation of all five documents, explicit Prettier and new relative-link checks passed. The complete previous session body remains byte-for-byte intact. A local Markdown invocation initially used an unavailable direct dependency/config path; the corrected check resolves the existing CLI dependency and repository configuration. The retained historical title uses a scoped MD025 directive. No lint rules for the new plan were weakened.

The source-aware critic approved the corrected plan hash `2f416b17ea258cb9b8e05826a0b56a8b6adadf3e14c46595f1015912dff7773a`, verification hash `11e67535d51f6a0f0b0a8512aed4223ede04e34a359279f83a9dc54aeac0151c` and spec hash `e79c5283793ab9efcf69488ae278292dbef9ab072d36df3bc74427e583dd1af5`. Hashes describe the reviewed bytes, not a product qualification.

Planning publication requires normal commit/push hooks and complete branch-specific Notion body/source/hash/destination readbacks before the owner briefing. Final publication receipts are maintained outside the mirrored source to avoid self-referential revision churn, in the scoped external evidence directory `/Users/letuscode/.codex/mcp-onboarding-plan-20261013`; no test success is inferred from those receipts. Product execution results will be appended against actual implementation revisions after owner agreement.
