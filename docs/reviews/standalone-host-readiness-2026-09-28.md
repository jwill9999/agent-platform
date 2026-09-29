# Standalone host readiness — 28 September 2026

## Outcome and boundary

The merged standalone runtime passed the local development-host readiness check. The canonical
journal is explicitly bound and discovery works. The service was then stopped cleanly. No managed
pilot, worker implementation, approval, paid generation, staging promotion or external delivery ran.

Pilot planning remains blocked by the existing skill-handoff assessment. A fresh restricted review
attempt failed before model launch because the snapshot loader rejects `.agents/skills/` paths.
This is a review-entrypoint compatibility gap, not a failed model review or runtime handoff test.
Do not copy or rename skill material to bypass the restriction. Resolve the supported evidence-reading
boundary within the existing assessment before claiming its required scenario checks passed.

Owning tasks: `agent-platform-pilot-zero.17` (host qualification), `.12` (skill handoff), and `.13`
(exact pilot planning). Beads remains authoritative for their status and dependency edges.

## Source and integration

PR278 merged into `feature/harness-backlog-review` at
`c9729617759be0cb0d3c89f7cb3b18f914553914` on 27 September. Its packages and CI configuration match
qualified source `3ec6b1afadd3d0975a8263ac3ee0e50fbcbeec06`. Prior component results remain in the
[R2/R3 report](artifact-import-coordinator-qualification.md); they are not new tests from this assessment.

This assessment uses `task/standalone-readiness`, baseline
`29b96baa` after merging the feature into the preserved task history. The package was built using
Node 24.14.0. No application or runtime source changes were made.

PR274 is also verified merged at `a8586aa425fc4907ef7aa374ff2d283d6eb0a1cd` on 26 September.
Its [skill assessment](orchestration-readiness-refresh-2026-09-26.md) and two independent reviews
are integrated historical evidence. They establish procedural review, not execution of all required
skill scenarios. Older Beads notes awaiting that merge need reconciliation, but integration alone
must not close unmet behavioral obligations.

## Canonical journal provisioning

The canonical workspace is `/Users/letuscode/projects/agent-platform`. Its journal resides under
`~/.codex/workflow-control/28d0df6dc7d1762064d7c275c3b1411f1dbc97ec01bd91beeb11c287afbca3b8/`.
Before migration, it contained four cancelled runs, no live lease and no workspace identity binding.

A private SQLite backup was created with the SQLite backup API, and the production migration was
first rehearsed against a backup copy. The supported CLI then bound the canonical journal to the
canonical workspace. Read-only discovery for `.17` returned `absent`, with no matching active or
terminal runs; an expired historical workspace lease remains visible. This task-specific result
must not be interpreted as absence of every historical run or every possible broker grant.

The post-migration integrity check returned `ok`; the original comparison reported unchanged rows.
The retained evidence initially contained only counts and a boolean. Review comment 1 correctly
identified that these alone did not make the preservation claim auditable.

On 29 September, a fresh read-only comparison of the retained pre-migration backup and canonical
journal produced matching SHA-256 whole-table digests for all four run rows, four contract rows and
seven lease rows. Separate before/after digests, column order, counts, capture time and source labels
are retained under `preservationAudit` in the [host evidence](evidence/standalone-readiness/local-host.json).
This is retrospective corroboration, not a contemporaneous migration digest or proof that no
intermediate changes ever occurred. Git readers can compare the retained digests; independently
recomputing them requires the private databases. No row contents or credentials are published.

### Reproducing the preservation comparison

Open the retained `readiness-20260928/before.sqlite` and canonical `workflow.sqlite` with SQLite URI
`mode=ro`, start a read transaction on each, and select every column from each of `runs`, `contracts`
and `leases`. Capture column names in cursor order and use this Python standard-library algorithm:

```python
import hashlib
import json


def canonical(value):
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"),
                      allow_nan=False).encode("ascii")


def cell(value):
    if value is None:
        return ["null"]
    if isinstance(value, bytes):
        return ["blob", value.hex()]
    if isinstance(value, int):
        return ["integer", str(value)]
    if isinstance(value, float):
        return ["real", value.hex()]
    return ["text", value]


def digest(columns, rows):
    encoded = sorted(canonical([cell(v) for v in row]).decode("ascii")
                     for row in rows)
    return hashlib.sha256(canonical(["sqlite-table-v1", columns, encoded])).hexdigest()
```

The digest covers all column names and typed cell values, including IDs and timestamps. Sorting
encoded rows removes retrieval-order dependence while preserving duplicates. Counts and column lists
must also match. Roll back the read transactions and close both connections; do not migrate or write.
The recorded algorithm checks confirmed row-order invariance, detection of a same-count row mutation,
preservation of duplicate multiplicity and distinction between an integer and its text representation.
No run was created, resumed, cancelled or approved by either comparison. Private backups remain
outside Git. This review correction changes evidence and documentation only.

## Development service qualification

A private, mode-600 operator configuration now exists at the same canonical journal directory under
`development/operator.json`; its containing directory has mode 700. It references the existing
Codex account, pinned broker and worker images and a dedicated state directory. It deliberately
omits `workflow`, so readiness does not enable task execution.

- Broker image: `sha256:7f8671d5961c4f9957057fa4f2d1d537266de30102f1234f6ec9771f7c265ea2`.
- Worker image: `sha256:e71bd7931f0cbfb4f5887ce5109f0b25095f3e8329b1656bf7ebed73efeb877f`.
- Codex client: `0.156.1`; Docker server: `29.8.0`; container identity: `501:20`.
- Service identity: `2f45e704-328e-48ac-8c7f-741ebbbefad6`, epoch 1.
- Configuration digest: `d82223173232134b4be9be28313b33bb8c7eed6c13812adb8ca8fac6a6e1f027`.

The supported `development-host` command reached effective status `ready`. This includes Docker and
network topology, broker conformance, authenticated model discovery, and revocation/denial checks.
It makes no generation request. `development-stop` returned `stop_requested`, the host exited zero,
and read-back returned effective `stopped`, null PID and no interruptions. Nothing was left running
by this assessment. The private operator configuration is reusable; Docker Desktop alone does not
start it, and readiness must be refreshed before any future run.

[Retained host evidence](evidence/standalone-readiness/local-host.json) binds source, compiled file
hashes, row comparisons, discovery, ready and stopped observations. Historical fault/recovery testing
remains in the [lifecycle qualification](development-lifecycle-qualification.md); it was not repeated.

## Skill review attempt and unresolved gate

The existing isolated-review CLI was supplied ten synthetic non-launch decision cases and the actual
planning, critique, implementation, orchestration and documentation skills. A dedicated internal
network and fixed model-only gateway were provisioned with no host port, credentials or socket
mounted into the gateway. Its only mount was the compiled gateway, read-only.

Snapshot preparation failed with:

```text
specialist source path is forbidden: .agents/skills/feature-planning/SKILL.md
```

The general private-workspace loader rejects that path before a reviewer starts. The older September
26 review predates this current loader behavior. No reviewer response, scenario pass or new critique
exists for this attempt. The temporary gateway and its two networks were removed afterward.

Retained [attempt result](evidence/standalone-readiness/skill-scenarios.json) and
[scenario inputs](evidence/standalone-readiness/scenarios.txt) distinguish blocked from passed.
The ten cases cover eligible new work, active ownership, failed lookup, changed documents, missing
capability, permitted direct assessment, failed predecessor, ambiguous task selection, planning
publication/verification, and unavailable independent critique. These are bounded decision tests;
even passing them would not prove actual runtime enforcement or autonomous execution.

The next bounded action belongs to `.12`: assess a supported read-only skill-evidence route that
preserves worker path protections, independently review any required change, then execute and retain
the decision scenarios. The existing `.10`/`.11` obligations remain open; do not waive them or create
a duplicate assessment programme. `.17` host evidence is complete for publication, but its new
qualification record awaits integration. `.13` is not unblocked by a healthy development service alone.

Once those gates are reconciled, prepare the exact `.13` plan. P4 remains the recommended candidate:
one outstanding hard-restriction-after-approval journey with independent backend no-effect assertions
and connected UI coverage. Recheck current tests before selecting the exact slice. This is not task
execution approval. Notion structural alignment stays separately deferred; staging stays separate.
