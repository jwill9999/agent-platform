# Harness modernization research

Durable research supporting the Beads harness backlog. **Beads is authoritative for scope, priorities, dependencies, decisions and implementation status.** These reports explain the evidence; they are not a competing scheduler or proof of implemented behavior.

## Current review direction

As agreed on 15 September 2026: refine **SDK modernization only**, sequentially, reusing this research. Visibility remains queued to conserve account usage. The first local release uses connected execution with explicit recovery; independent execution while the application is closed is deferred. No migration, paid experiments or implementation allocation is approved by these reports.

Keep existing observability, context optimisation and research work, plus unfinished project-delivery acceptance and macOS release checks. Bigger IDE expansion, reusable packaging and broader self-improvement remain later scope. These decisions supersede earlier parallel-tranche suggestions and forecasts in the dated reports.

## Reading order

1. [Implementation proposal, version 2](implementation-proposal.md): SDK upgrade-versus-framework replacement decisions and proposed tasks; apply the newer sequential scope above.
2. [Final independent critique](reviews/final-independent-critic-review.md): six residual refinements and evidence.
3. [Framework reuse analysis](framework-reuse-analysis.md): architecture, recovery, telemetry, context and knowledge research.
4. [Beads creation review](beads-backlog-review.md): historical mapping of the created records and proposed old-record dispositions. Read current Beads before acting.

## Beads entry points

- `agent-platform-harness-review-gate`: joint decisions and old/new ordering.
- `agent-platform-harness-modernization`: modernization investigation epic, currently held for review.
- `agent-platform-harness-f0` through `agent-platform-harness-f3`: support assessment, compatibility, representative comparison and architecture decision.

Their specifications are in [the task directory](../../tasks/README.md). Approval and task evidence live in Beads; tests and implementation contracts are refined before execution.

## Historical material

The `archive/` directory preserves the initial brief, earlier resolution plan, review outcome and old backlog audit. `reviews/critic-review.md` is the first critique; `reviews/review-scorecard.md` accompanies it. Later findings and recorded owner decisions take precedence. Framework versions and local code observations are dated snapshots, not claims of current compatibility.

Only authored analysis is included. Downloaded third-party documentation excerpts and raw Beads JSON snapshots are not copied into the repository. `provenance.json` records original source hashes; relative links were normalized for repository use, so the copies are not byte-identical originals. Original local research remains intact.
