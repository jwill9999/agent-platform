# Memory Model

The memory system now has three separate layers:

- Durable long-term memories in `memories` and `memory_links`.
- Short-term working memory in `working_memory_artifacts`.
- Pending candidate memories extracted from corrections, failures, remediations, and explicit remember instructions.

Long-term memories are not automatically retrieved into prompts yet. Working memory is session-scoped and can be injected into the current session prompt to preserve task continuity across long conversations and resume flows.

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

## Working Memory

Working memory artifacts are stored in `working_memory_artifacts` and keyed by `sessionId`. They capture transient task state:

- Current goal, active project, and active task.
- Key decisions inferred from recent user/assistant turns.
- Important file references.
- Tool names used and bounded tool summaries.
- Pending approval IDs and blockers.
- Next expected action.

Working memory is inspectable through `GET /v1/sessions/:id/working-memory`. It is intentionally not a durable knowledge base and is not promoted into `memories` automatically.

Tool outputs are summarized before persistence. Raw tool payloads are not copied wholesale into working memory.

## Candidate Extraction

The chat runtime runs conservative candidate extraction after a successful chat or resume turn. Candidates are stored in `memories` as:

- `status: pending`
- `reviewStatus: unreviewed`
- `source.kind: observability`
- `metadata.candidate: true`

Candidates are never active memory before review. They are only raw proposals for later review/UI tasks.

The v1 extractor looks for:

- Explicit user instructions such as "remember", "make a note", or "note that".
- User corrections and replacement instructions.
- Repeated tool/runtime failures with the same signature.
- Tool/runtime failures followed by assistant remediation language.

Candidate metadata includes rationale, evidence excerpts, and the suggested scope. Candidate content is credential-scanned before storage. Credential-like strings are redacted and the memory is marked `safetyState: redacted`.

## Retrieval Boundary

Durable long-term memory still has no automatic retrieval in this increment. Pending candidates are not retrieved. Later tasks should make long-term retrieval explicit, auditable, and policy-gated before any durable memory content is inserted into model context.
