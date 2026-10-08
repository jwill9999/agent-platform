# Governed offline test adapter — review and qualification

Status: R3 planning independently approved; implementation and governed qualification in progress. Phase acceptance, code review, hosted gates and feature integration remain pending.
Task: `agent-platform-test-runner-loopback`; branch `task/test-runner-offline-adapter`; cumulative
integration destination `feature/harness-backlog-review`. Owner delegated prerequisite repairs on
8 October, targeting 9 October. No live pilot, paid model call or production approval.

[Plan](../planning/test-runner-offline-adapter/plan.md),
[specification](../tasks/agent-platform-test-runner-loopback.md),
[verification](../testing/test-runner-offline-adapter.md) and
[ADR proposal](../adr/0004-codex-development-orchestration-control-plane.md) are current planning snapshots at
`00eda68ffd0b77a109bbae1cbdaeddc70ee65b24`. Their proposal labels retain publication-time status.
[Version 1 contract](../planning/test-runner-offline-adapter/execution-contract.v1.json) passed
supported document-object publication and production schema validation.
[Manifest bindings](evidence/test-runner-offline-adapter/planning-validation-r2.json) retain exact hashes.

[Independent review](evidence/test-runner-offline-adapter/plan-review-r2.json) approved material
`sha256:c84f459388bb66774d6da14554f29417d8070c0d3c5c4b5163561d364462ede2` with zero findings.
The distinct critic reviewed supplied revision-bound material/source semantics without tools, under
the supervised procedural exception; inherited tools were not technically disabled. This is not
managed isolated-worker evidence, a production approval or a pilot result. Publisher machine
validation verifies the carrier schema, exact material and four document hashes/sizes.

L-T01–04, implementation tests, independent patch review and final cumulative hosted/feature gates
remain unexecuted. Old direct image success establishes feasibility only. Actual governed adapter
qualification must restage current source and demonstrate connected backend/Electron, adjacent
denials, receipt integrity, resource/budget/deadline and restart/cleanup controls with fixture
boundaries disclosed. No task or readiness closure from this planning review.

Initial r1 material/review at a94a414 remain in Git and retained evidence. Before code, source
review identified the risk of treating a fixed suite as proof of arbitrary criteria. Current r2
requires exact approved criterion-to-fixed-command mappings, no default classification and an
independent final coverage assessment; unsupported semantic claims remain blocking. The distinct
critic approved r2 with zero findings after receiving the complete prior material and exact delta.

## R3 implementation checkpoint — 9 October

Current normative source `ea1ccd55006e3b61a4b70294caa42477ad5fffe3`, material
`sha256:c7db34dc1e8de51d8e8e4198f846112dedd600ae3423d9ad28c75d63a5ea3230`.
The distinct evidence-only critic approved the narrowly typed secure-evidence correction; the
publisher verified its version1 review/contract and every document byte. Inherited tools were not
technically disabled. Earlier R1/R2 receipts remain historical; no production approval was created.

The current prototype adds explicit mapped adapter selection, a fixed immutable-image/entrypoint
route with network none throughout, separate receipt validation, private result provenance and typed
secure evidence ingestion. Legacy Codex role generation is unchanged. Source code is being qualified;
implementation is not yet delivered or independently accepted.

[Intermediate qualification](evidence/test-runner-offline-adapter/qualification-intermediate.json)
retains actual supervised governed-phase container results: full build, 79 backend tests and exactly
one Electron approve/provider-http test passed. Host validation checked unchanged sorted source
hashes, explicit source/input/criterion bindings, actual approved application approval and a single
successful tool audit. Own loopback worked; protected/private/link-local/external probes were
unreachable, refused or DNS-failed. Source/input/entrypoint/root writes were denied; auth/config and
Docker socket paths were absent. The application provider uses scripted HTTP and its command runner
is a fixed-command fixture; these results do not prove a real VM or upstream-model behavior.

The phase deliberately blocked when the existing evidence residual scanner rejected its new receipt
or log representation. Failure evidence, container absence and credential revocation were retained.
R3 preserves all-byte direct-secret scanning and conservative unknown-entropy redaction, with separate
original and sanitized hashes. The decoded log bytes are scanned independently so JSON newline
escaping does not merge unrelated tokens into artificial entropy candidates. Generic ingestion keeps
its existing rejection behavior. Qualification is rerunning with the typed boundary and negative
controls; no completed phase or final code approval is claimed yet.

Focused contract/launcher tests passed; 34 vault/adapter checks and typecheck passed at the recorded
checkpoint. An earlier focused run during concurrent Docker build load hit an existing one-second
budget fixture timeout; its failure is retained. Run controlled full regression after container work,
then independent complete code review and cumulative exact-head hosted/feature gates. SonarQube and
IDE Problems connectors are unavailable; retain this diagnostic coverage gap with terminal checks.
No pilot, paid model call, main/staging promotion or task closure occurred.
