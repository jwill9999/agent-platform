# Workflow-control evidence and evaluation

Task and feature verification use `SecureEvidenceVault` and `ContractEvaluator`; callers do not pass
filesystem destinations or treat free-form agent output as acceptance evidence.

## Secure evidence

The vault redacts known credential forms and runs a residual secret scan before writing bytes. It
accepts only bounded text, JSON, NDJSON, PNG, and WebP content. JSON is structurally redacted and
revalidated before persistence. The SQLite record binds each SHA-256 digest to workspace, run, task,
producer role, contract, policy, broker-approved exact Git head, retention class/deadline, and
redaction count. Secure blobs are stored as content-addressed SQLite BLOB rows so metadata, quota
reservation, and content insertion share one transaction and the secure path accepts no
caller-controlled filesystem location. Residual scanning fails closed on unlabeled high-entropy
tokens, including two-character-class and hexadecimal candidates; only explicitly labelled commit and
SHA-256 digest fields are exempt.

Both per-artifact and per-run limits are enforced. The authoritative per-run quota check and metadata
insert occur in one SQLite transaction, so concurrent writers cannot independently consume the same
remaining quota. Production reads and writes require process-bound capabilities; test-only role claims
are accepted only while `NODE_ENV=test`. Evaluation reads authorize against the secure producer record,
not a separately forgeable legacy evidence binding.

Acceptance is append-only. Each evaluation-to-evidence acceptance has its own durable binding and is
committed atomically with the evaluation; the evidence record retains the first acceptance timestamp.
The module-owned clock assigns every evidence BLOB a non-overridable 30-day raw retention period.
Compact evaluation decisions and their evidence digests remain durable in evaluation rows rather than
extending the lifetime of raw content. After retention expires, an authenticated orchestrator deletion
removes the blob only after the last live binding is tombstoned. Every read rehashes the stored BLOB;
tombstoned identities cannot recreate it.

## QA and feature evaluation

An evaluation must enumerate every frozen acceptance criterion exactly once. Each criterion includes a
pass/fail result, summary, and at least one secure evidence reference at the exact evaluated commit.
Evidence media type, size, kind, producer role, run, task, contract, policy, and head are checked against
the authoritative secure record. The resulting evaluation id is the SHA-256 digest of the complete
request, making retries deterministic.

## Append-only repair children

Only `DurableRepairChildBroker` may append a feature repair child. Before preparing or mutating it
requires all of the following:

- workflow state is `repair_planning` and workspace/run/current-tip task leases are current;
- the cited durable evaluation failed the named criterion at the exact approved chain-tip SHA;
- finding evidence is a subset of that failed criterion's evidence;
- id and sequence match `<feature-id>.repair.<sequence>` and carry the remaining feature retry budget
  calculated from durable attempt rows plus the atomically reserved initial child attempt;
- parent epic, dependency, branch parent, role, paths, and operations stay inside the frozen contract;
- the branch parent SHA matches the broker's approved chain-tip snapshot.

The intent is persisted before the external write. Production construction accepts only the concrete
official Beads/Dolt port and local Git delivery port; arbitrary structural clients are available only
through a `NODE_ENV=test` factory. Beads reconciliation checks the exact task id, open task status,
task type, spec identity, parent, dependency, role, paths, operations, finding digest, and remaining
budget. Ref creation is a create-only compare-and-swap.

Committing the intent atomically records the new repair ref as a broker-approved head and its scoped
task authority. Subsequent commits, evidence, evaluations, and another linearly chained repair child
therefore use the same trusted lineage checks as original contract tasks. A subsequent child is denied
until its predecessor has advanced beyond the inherited base SHA and a committed brokered Beads close
proves normal verification, review, acceptance, and integration completed. Extra task/finding attempts
consume the aggregate feature repair budget and can exhaust it before the maximum child count.

If the orchestrator stops, a newer workspace/run/task lease owner can adopt the prepared intent,
observe existing external state, and commit without repeating the effect. Conflicting external state
is durably escalated without mutation.
