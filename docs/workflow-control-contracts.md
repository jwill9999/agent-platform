# Workflow-control contract versions

The repository-local workflow-control package owns the machine-valid execution contract and workflow
lifecycle records used by Codex development orchestration. It does not import GitHub, Git, Beads, or
product-runtime adapters.

## Version policy

- `contractVersion` is an integer discriminator. Version `1` is the only accepted version initially.
- Stored contracts are immutable. A parser for an older version remains available until a dedicated,
  tested migration can create a new immutable record.
- A migration never edits the approved record in place. It writes a new version, recomputes the
  policy digest, invalidates prior approval, and returns the workflow to human approval.
- Unknown or stale contract versions and policy digests fail closed before any transition or broker
  operation.
- Objective, requirements, authority, delivery target, repository, base, merge method, allowed paths,
  or allowed operations may not expand through a migration without new human approval.

## Retry accounting

Attempt `1` is the initial attempt. Every attempt has one non-empty hypothesis, including the initial
hypothesis. Task, finding, and infrastructure-check counters are separate; one counter cannot consume
or replenish another counter's budget. A counter whose `attemptsUsed` exceeds `maxAttempts` is invalid.

## Time and recovery

Wait records distinguish `nextPollAt` from `absoluteWaitDeadline`. A poll can resume pipeline checks,
but it cannot extend or reset the absolute deadline. Recovery records preserve the exact interrupted
normative state and require a strictly newer lease epoch. After a verified merge, the only safe
recovery target is `finalizing`.

## Closure

A run may enter `closed` only when merge, epic closure, Dolt remote synchronization, and final
evidence are each verified and have content-addressed evidence. Interrupted closeout remains in
`finalizing` and is reconciled idempotently.
