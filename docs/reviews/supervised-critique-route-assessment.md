# Supervised critique route assessment

## Owner intent and implemented material

The owner authorized independent read-only feedback on plans, skills and implementation reviews
outside orchestration. ADR-0004, security guidance and plan-critique now describe a bounded supervised
no-tool procedure. It is instruction-constrained, not enforced removal of inherited tools.

## Independent review performed

A distinct plan_critic subagent named supervised_review_route reviewed a supplied textual proposal
and selected skill summaries, returning findings only. It was not given the full skill source set.
The coordinator authored the proposal; the reviewer was a separate agent. This is a limited second
opinion, not a criticReviewSchema contract approval or a complete skills review. No tool calls were
reported in the returned review; there is no independent tool-capability audit here.

Reviewed material: the proposed exception and supporting evidence before this commit, based on source
revision d77714c. The supplied proposal was not content-addressed; exact formal material binding was
absent and is explicitly not claimed retrospectively.

## Findings and dispositions

| Finding                                              | Evidence and disposition                                                                                                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formal acceptance binding missing                    | Correct: no schema-valid content-addressed contract review or persisted approval exists. Keep formal acceptance blocked.                                                                                                                    |
| Cancelled runs do not prove absence of broker grants | Canonical read-only refresh found four cancelled runs, no scheduler executions and zero unexpired leases. Capability maps are process-local in authorization.ts; global absence is not proven. Entry gate strengthened; remains unresolved. |
| No-tool instruction does not prevent mutation        | Explicit limitation retained. A deviation requires stopping and assessing effects, not merely discarding findings.                                                                                                                          |
| Exception was described as proposed                  | Policy files now contain the change on this task branch; feature integration and review remain outstanding. It is not a runtime enforcement change.                                                                                         |

The first second-opinion exercise was invoked before broker absence had been fully established.
Consequently it does not pass the exception's full entry conditions and must not be treated as a
successful qualification. Its findings are useful evidence. Do not repeat invocation under this route
until that precondition is established or a separately reviewed boundary resolves the uncertainty.

## Remaining blocker

The runtime helper assertBuiltInCollaborationAgentAllowed still rejects exposed mutation tools; it
was deliberately not modified. The documented exception does not alter an active managed run's guard.
A supported way to establish broker ownership/capability absence or provide a genuinely isolated
reviewer is still needed for qualified use. Docker is currently unavailable and terminal Codex is
version 0.30.0; neither establishes an isolated live reviewer. No full skill critique, sandbox
conformance, pilot success or autonomous acceptance is claimed.

Static skill/Markdown/reference validation applies to this documentation change. The related Beads
task remains in progress. Human review of this limitation and further bounded technical work precede
claiming that formal plan critique is unblocked.

## Account-backed reviewer follow-up

Two live independent Codex reviews completed using the owner's approved existing account.
See [the isolated review report](../workflow-control-supervised-review.md) for evidence and limits.
Findings led to source-path, container settlement and Playwright checklist corrections. Actual
session tool inventory and enforced tool denials remain unverified; these reviews do not yet
qualify the restricted critic or authorize the orchestration pilot. Detailed-document approval
binding is separately tracked in `agent-platform-pilot-zero.16`.
