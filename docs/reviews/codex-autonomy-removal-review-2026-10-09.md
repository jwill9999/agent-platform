# Independent review of the Codex autonomy removal proposal

**Date:** 9 October 2026

**Proposal:** R1, scoped outline for a future planning task.

**Planner/coordinator:** `/root`

**Independent critic:** `/root/codex_autonomy_plan_critic`

**Verdict:** `APPROVED`; zero findings.

**Related task:** [agent-platform-codex-autonomy-plan](../tasks/agent-platform-codex-autonomy-plan.md).

## Reviewed proposal R1

After joint agreement of requirements, definition of done and tests, Codex should progress
autonomously through implementation, repair, testing, independent review and CI evaluation to
final owner acceptance. Routine file/subtask/retry refinements should not require renewed approval;
changes to owner intent or explicitly reserved actions remain distinct.

1. Rewrite repository instructions and planning/implementation/critique/orchestration/documentation
   cross-references so native Codex is the normal route. Remove mandatory custom managed readiness,
   exact-material authority and no-tool review procedures; retain independent automated review.
2. Remove developer profile sandbox overrides and the custom concurrency cap. Inherit actual session
   settings and retain useful responsibilities without changing global configuration or promising
   to bypass Codex platform rules.
3. Disconnect the generated restricted worker launcher and broker exclusivity from ordinary native
   development. Preserve the paused workflow-control prototype, enforcement, recovery, durability,
   evidence and tests. Do not blanket-delete the package or make its launcher permissive; it remains
   part of recursive workspace build/test gates.
4. Supersede ADR-0004's default developer-policy status and reconcile linked guidance, stale
   worktree copies and automation prompts. Preserve historical evidence and dirty worktrees.
5. Use available native tools for agreed Git/Beads/documentation work. Keep meaningful quality and
   product-security checks; custom isolation/budget/gateway admission does not gate unrelated tickets.
6. Keep global configuration, installed skills and memory unchanged. Inventory exact proposed
   global-guidance follow-ups for separate owner discussion.
7. Preserve product harness security, approval routes/contracts, secret handling and permission
   tests. Do not resume the paused pilot, make paid gateway calls or promote main/staging.

Verification proposals include artifact/TOML/link checks, semantic instruction review, preserved
file baselines, existing product-security regressions, fresh-session adoption and a later authorized
representative ticket demonstrating the native end-to-end workflow. No future scenario was executed
for this outline review. Product E2E remains applicable when assessing actual product behavior.

The resulting Beads task should remain open and unassigned, requiring an inventory, replacement
policy, implementation task/dependency breakdown, test mapping, safeguards and definition of done.

## Raw critic report

The critic used read-only source inspection. No technical isolation of inherited tools is claimed.
The owner expressly requested this native independent review. The report below is retained as
returned, with relative paths resolved against the source worktree.

```json
{
  "verdict": "APPROVED",
  "review_scope": "R1 proposal for planning; not a machine-validated execution contract",
  "findings": [],
  "evidence": [
    {
      "requirement": "1–2: Remove restrictive developer defaults while retaining independent review",
      "references": [
        ".codex/config.toml:1–4",
        ".codex/agents/feature-planner.toml:3–9",
        ".codex/agents/plan-critic.toml:3–10",
        ".agents/skills/feature-planning/SKILL.md:108–134",
        ".agents/skills/plan-critique/SKILL.md:21–35"
      ],
      "assessment": "The stated configuration and instruction restrictions exist. R1 addresses both sandbox overrides and mandatory managed-review/approval routing."
    },
    {
      "requirement": "3–4: Preserve the prototype and paused work",
      "references": [
        "packages/workflow-control/src/specialistRoleProfile.ts:35–83",
        "docs/adr/0004-codex-development-orchestration-control-plane.md:22–58",
        "session.md:1–54",
        "package.json:11–14",
        "pnpm-workspace.yaml:1–3"
      ],
      "assessment": "Generated capability restrictions belong to the developer prototype. Keeping its enforcement intact while superseding its default developer-policy status is feasible. The package remains part of recursive workspace gates, and existing dirty work must remain preserved."
    },
    {
      "requirement": "5–7: Retain delivery and product-security boundaries",
      "references": [
        "docs/agent-instructions-shared.md:169–185",
        "packages/harness/test/approvalPolicy.test.ts:4–21",
        "packages/harness/test/pathJail.test.ts:57–94",
        "packages/harness/test/toolDispatch.test.ts:662",
        "apps/api/test/approvalRequestsRouter.test.ts:75–110"
      ],
      "assessment": "R1 preserves meaningful approval, denial, path-escape and delivery controls. Proposed verification appropriately separates documentation/profile checks from later authorized product journeys."
    }
  ],
  "authority_boundary": "Approval supports creating the OPEN, unassigned planning task with the specified inventory, dependency breakdown, tests and DoD. It does not approve removal implementation, global changes, prototype resumption, testing, promotion or pilot launch.",
  "verification": "Read-only source inspection only; no tests or mutations performed."
}
```

## Disposition and limitations

No findings required correction. The coordinator created the planning issue after receiving this
verdict. Outline approval does not establish that the detailed future implementation plan is complete,
that developer restrictions have been removed, that tests passed or that the owner approved a launch.
No machine-persisted workflow approval or final implementation review is claimed.
