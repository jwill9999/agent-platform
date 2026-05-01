# Memory Model

The first memory increment adds the shared contract and SQLite persistence model only. Memory records are not automatically retrieved into prompts in this task.

## Record Shape

Each memory has:

- `scope`: `global`, `project`, `agent`, or `session`.
- `scopeId`: required for project, agent, and session memories; omitted for global memories.
- `kind`: `fact`, `preference`, `decision`, `procedure`, `failure_learning`, `correction`, or `working_note`.
- `status` and `reviewStatus`: workflow state for whether the memory is usable and reviewed.
- `confidence`: a number from `0` to `1`.
- `source`: source kind, optional id/label, and non-secret metadata.
- `expiresAtMs`: optional expiry used by repository queries.
- `safetyState`: `unchecked`, `safe`, `redacted`, or `blocked`.

Source metadata and memory metadata are redacted before persistence for common secret keys such as API keys, tokens, passwords, credentials, and authorization values.

## Storage

Memory records are stored in `memories`. Optional relationships are stored in `memory_links` so later tasks can model corrections, replacements, contradictions, and supporting evidence without introducing a graph database in v1.

Repository queries support scope, kind, status, review status, confidence floor, source kind/id, source metadata filters, tags, and expiry filtering. Expired memories are excluded unless `includeExpired` is set.

## Retrieval Boundary

This task deliberately does not add prompt injection or automatic retrieval. Later tasks should make retrieval explicit, auditable, and policy-gated before any memory content is inserted into model context.
