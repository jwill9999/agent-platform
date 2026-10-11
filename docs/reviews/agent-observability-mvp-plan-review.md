# Agent diagnostics MVP — planning review

Status: approved by independent critic for final owner implementation decision. This is not implementation or test evidence.
Source baseline: staging `7814b59845b52ad5f850bfc99b7baee0e6742a25`.
Task: `agent-platform-harness-v1`; [contract](../planning/agent-observability-mvp.md);
[tests](../testing/agent-observability-mvp.md).

## Earlier independent critique and corrections

Distinct reviewer: `visibility_delivery_review`. Read-only review was a procedural assignment,
not technical isolation of inherited tools. The reviewer inspected source and approved the revised
discussion proposal, including the adapter and configurable retention direction. This does not
substitute for the final critique of the written MVP with the subsequently agreed export UI.

| Finding   | Severity | Correction incorporated in written contract                                                                               |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| OBS-V1-01 | High     | R7 observational data cannot control dispatch, admission, retries or replay; mandatory intent storage remains outside V1  |
| OBS-V1-02 | High     | R2 single allowlist projection before logger/store/read/export; raw tool rows and free-form errors excluded; T02 canaries |
| OBS-V1-03 | High     | R1 trusted per-ingress identity, separate caller metadata, request-only failures and duplicate correlation tests T01      |
| OBS-V1-04 | Medium   | R3 durable sequence, scoped snapshot cursor, explicit gaps and unknown-after-restart; T03/T04/T07                         |
| OBS-V1-05 | Medium   | Scoped owner checkpoint and V1 edge reconciliation only; old broad gate/paused work retained                              |
| OBS-V1-06 | Medium   | Concrete T01–T12 file/environment/effect map with packaged export and explicit doubles                                    |

Final critique must also assess storage bounds/lifecycle, report privacy and access, small-scope UI,
effort/stop point, exact task/dependency mapping and packaged verification feasibility. Findings will
be retained here with correction and recheck evidence. Planned tests have not been executed.

## Final written-plan critique — correction round

The critic returned correction_required on the first complete written plan. No product decision
was missing. The coordinator made these bounded corrections and requested a focused recheck:

| Finding    | Severity | Source-backed correction                                                                                                                                                |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OBS-MVP-01 | High     | Actual API wildcard/no-auth source acknowledged; require explicit loopback deployment, private server capability, Host/Origin and scope checks; T11 tests denial paths  |
| OBS-MVP-02 | Medium   | Dedicated typed partial-failure IPC reprojected by main, labeled current-view/unverified/non-durable; no backend fetch, arbitrary body/path/URL; packaged API-down test |
| OBS-MVP-03 | Medium   | DELETE rollback journal, 64 MiB DB + 66 MiB journal, 130 MiB combined budget; one worker, bounded transactions/read lifetime, held-reader/busy/recovery fixtures        |

Recheck verdict: **approved**, no actionable findings. Reviewer `visibility_delivery_review`
independently rechecked the corrected source and confirmed OBS-MVP-01/02/03 resolved. These are
plan corrections, not implemented protections or test passes. Actual feasibility and limits still
must pass the prescribed implementation tests.

Reviewed contract SHA-256: `c6f4b698adc23c9674e5c123f83287d90c5253aac110947f113062d27210624d`.
Reviewed task SHA-256: `1d5cf352f52c64dcf63c5e55fc6edd6daf4f4db0eef54b486796901630a2cc0e`.
Reviewed verification SHA-256: `0333f057da68a5a29c7efa0400756ccfc5caa0976d96a2151d544eedf8277860`.
The original V1 and session history bodies were independently confirmed byte-exact.

## Planning validation and delivery

Direct Markdown validation covers all five authored documents, including directories excluded by
the repository CLI defaults. Formatting, relative artifact links and historical-body preservation
were checked. Runtime scenarios T01–T12 remain not run; no implementation exists yet. Publication
revision and full Notion readback receipts are recorded in the canonical Beads notes after push.
Final owner implementation agreement and scoped V1 dependency reconciliation are still pending;
the broader gate and parent remain open. This status update records the critic's actual verdict,
not another source or implementation approval.
