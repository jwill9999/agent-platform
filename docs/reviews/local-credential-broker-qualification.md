# Local credential broker qualification

## Scope and authority

The owner authorized creating the local broker with the existing Codex account, extending R4 of
`agent-platform-pilot-zero.17` beyond qualifying an existing broker. See the
[scope addendum](../planning/standalone-pilot/broker-addendum.md). Delivery is supervised bootstrap
on `task/standalone-pilot-plan`, targeting `feature/harness-backlog-review` through PR275. No managed
run, pilot, merge or staging promotion is included. R1–R3 and broader R4 host qualification remain open.

## Delivered behavior

The trusted gateway retains account credentials; workers receive opaque, individually revocable
leases. SQLite retains hashed tokens and durable revocation tombstones. Restart rotates generation
and invalidates old tokens; the replacement owner can observe/revoke known old-generation leases.
The trusted control CLI supplies the existing issue/revoke/status/conformance protocol through a
private generated executable. Optional runtime `modelGateway` configuration selects an operator
model and private gateway without granting additional workflow authority.

Only fixed Codex HTTPS model endpoints are forwarded. Account headers are replaced; supported
request compression is preserved; arbitrary destinations, CONNECT, WebSocket and redirects are
denied. Local streams terminate on revocation, expiry or owner replacement. Remote computation
already accepted cannot be undone. The 50 ms sweep is a scheduling interval, not a measured hard
latency guarantee. This does not claim cost quotas or isolation from trusted host/Docker administrators.

## Verification

- Focused broker/gateway tests: 16 passed, including the compiled executable with an empty environment,
  actual runtime broker conformance, compression bytes, denied WebSocket/CONNECT, stream revocation,
  expiry and overlapping-owner fencing. The production conformance assertion was added after the
  full Linux run; the affected nine-test file passed again afterward.
- Full Linux package regression: 891 passed, 17 optional skipped, 48 files passed/5 skipped. The
  disposable runner included the pre-push hook and ran as nonroot. Native full-suite failures were
  caused by hardcoded Apple Git calls requiring the unaccepted Xcode licence; no licence was accepted.
  An initial Linux fixture omitted the hook and ran as root; correcting the fixture cleared its failures.
- Build, TypeScript and package ESLint pass. SonarQube/IDE Problems tooling was unavailable; terminal
  checks are the fallback gate. Hosted PR checks are separate and must be checked before merge.
- Real Codex client completed a model turn through the gateway with only opaque worker auth. Account
  and control secret were mounted only in the gateway. The final image qualification is retained in
  [sanitized final evidence](local-credential-broker-evidence/final-qualification.json).
- Revocation denied subsequent requests with HTTP403. Restart rotated generation, reported the old
  lease revoked and denied its token. Control adapter operated with an empty environment. The model
  catalogue's HTTP400 proves admission/transport only; the separate completed model turn establishes
  client compatibility. Random Docker host port changed on restart during the first qualification
  attempt; refreshing the private client configuration resolved it. Production should pin that port.

Independent isolated review found three actionable issues: missing executable protocol adapter,
dropped compression metadata, and an incomplete delayed-first-issue conformance probe. All were
repaired with regression coverage. The follow-up source review found no blocking findings. The evidence review accepted the limited
component conclusion but requested stronger provenance and validation transcripts. Those are now
retained alongside container/network inspection, correlated worker/lease/revoke records, and a
59-file compiled JavaScript comparison between the exercised image and local build. Network
containment remains an explicit operator deployment requirement, not automatic runtime validation.
The complete production launcher lifecycle with this broker remains untested. Reviews are independent
feedback and never substitute for owner approval. The addendum subsequently gained only this report
link; the reviewed source hashes remain unchanged. See retained review1–review4 JSON artifacts. Final independent evidence review approves this limited
component qualification with no remaining actionable blockers. The local fallback quality gate passes;
hosted PR checks and full .17 acceptance remain separate.

## Operator setup and remaining boundary

Build the package and `packages/workflow-control/credential-runtime/Dockerfile` from repository root.
Use a private absolute JSON configuration with `database`, `accountFile`, `controlKeyFile`, distinct
`gatewayPort`/`controlPort`, optional `listenHost` and `leaseTtlMs` (1–3600 seconds, default300 seconds).
The account file, control key and config must be regular private files (0600); the control key is a
random 32-byte hex value. Use a private0700 state directory on the trusted host. Do not put secrets
or worker auth in Git. No account credentials are generated, refreshed or copied into worker homes.

Run the gateway image as nonroot with a read-only root filesystem, dropped capabilities and
no-new-privileges; only its state directory is writable. Mount account/control/config read-only.
Attach gateway to an internal worker network plus an outbound network. Publish only the control
port on host127.0.0.1 with a fixed host port. Workers join only the internal network; no account,
control key, Docker socket or host mounts. In this topology `listenHost` is `0.0.0.0` inside the
container; a native development service defaults to loopback and is not worker containment proof.

The host-side private config uses the published loopback control port and host paths. Generate the
executable with `node packages/workflow-control/dist/localCredentialBrokerCli.js /absolute/config.json
create-adapter --output /absolute/broker.mjs` (one command). Its absolute Node/module/config paths
must remain valid. Configure the runtime's `credentialBrokerBinary` with this executable, plus
`modelGateway: {"url":"http://model-gateway:8080","model":"<operator choice>"}`. The generated adapter
pins configuration, not authority: the runtime still performs conformance and journals lease use.
After restart, new work needs the new attested generation; old work cannot reuse credentials.

This component is ready only to support subsequent host qualification. It does not complete run
admission, implementation import, coordinator phase completion or SP-01–SP-13. `.17` remains in
progress and `.13` remains blocked. The first single-task orchestration pilot has not run.

## Hosted analysis follow-up

SonarCloud identified SHA-256 file hashes as secrets because paths containing credential/auth were
JSON keys. The evidence now separates `path` and `sha256` fields; digest values are unchanged.
No account or lease secret was committed. The CLI adapter-generation helper was extracted to reduce
complexity, the CLI entry uses top-level await, and minor optional-chain/Dockerfile findings were
corrected. Independent source review5 found no blockers in these cleanup changes; it did not
independently re-execute tests or verify equivalence to the prior snapshot. Retained cleanup logs
show build/lint and the affected16 tests pass. Earlier image/client records identify the pre-cleanup snapshot. Refreshed `final-*` artifacts now
record the final source and image: full Linux891/17 optional skipped again, real client turn,
revocation403, restart generation fencing and another59-file compiled JavaScript match. These
final repeated qualification observations were collected by the coordinator; review5 assessed source,
while review4 assessed the prior qualification evidence. No complete launcher/pilot proof is implied.
