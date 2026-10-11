# Standalone host prerequisite assessment

Task: `agent-platform-pilot-zero.17`, requirement R4. Owner authorized continuing after the reviewed
scope in PR275. Inspection used task/standalone-pilot-plan at `5d26b34c279eb2d7c6766b4060363ebcd28e1351`.
[Sanitized observations](evidence/standalone-host-prerequisites.json) retain the inspection scope/time.

## Result

**Implementation handoff blocked by an unqualified managed credential broker and runtime configuration.**
This is a technical provisioning gap, not a request to repeat the owner's authorization. No managed
workflow launched and no runtime source changed. The plan explicitly requires resolving the provision
path before implementation handoff; owner approval does not manufacture those missing capabilities.

The canonical workspace journal was opened with SQLite `mode=ro`, avoiding constructors that migrate
or initialize it. It contains four cancelled runs and no unexpired leases at inspection time. This is
not a concurrency lock or evidence that no in-memory grant exists. No workflow environment variables
were configured. No JSON in the canonical workflow directory specified `credentialBrokerBinary`;
no broker-named executable appeared in the three recorded conventional binary directories.
This bounded search does not establish machine-wide absence or authorize adopting another run.

The actual Git fallback responds with version 2.53.0; Docker responds with version 29.8.0 at its
production absolute path. Existing standalone production source checks still invoke `/usr/bin/git`;
the proposed R4 repair must use and pin the trusted executable consistently. The existing reviewer
image is not qualified as a managed implementation environment and no managed image/network/user
configuration was established. No paid model or credential conformance probe was issued.

## Missing provision path

`RevocableSpecialistCredentialBroker.create` in
[specialistLauncher.ts](../../packages/workflow-control/src/specialistLauncher.ts) calls an external
absolute executable. The required protocol is issue, revoke, status and conformance. The repository
package supplies the client, not a configured production credential service. Tests include controlled
fixtures; those do not qualify a live broker.

The service must issue idempotently by execution/lease/generation, enforce durable revoke-wins
semantics against delayed issue, retain revocation tombstones, return generation-bound status and
ensure revoked credentials actually cease working. The conformance probe must have broker-owned
cleanup with at most 30 seconds TTL. Merely echoing the expected JSON or deleting a copied auth file
would not meet the requirement. The evidence-only reviewer reuses account credentials within its
separate isolation boundary; it cannot provide per-worker revocation evidence.

## Bounded follow-up within R4

Before the remaining repair handoff, identify an existing conformant service and its provision path.
If none exists, prepare the missing broker adapter/service design within .17's recorded feasibility
work; do not invent an executable path or silently relax credential requirements. The recommended
candidate for assessment is a local model gateway issuing opaque per-worker leases while keeping the
existing account credential only at the trusted gateway. This is a proposal, not a chosen or installed
implementation. It must be assessed against the Codex client transport and authentication behavior.

Acceptance requires real allowed-before-revoke/denied-after-revoke requests, delayed-issue races,
restart-persistent revocation, generation mismatch rejection and bounded probe cleanup. A real
managed image, restricted network and production factory startup must then be qualified together.
If a new gateway/service needs paths, network or authority beyond the reviewed contract, revise and
critique that exact material before implementation. Do not treat ordinary account reuse as proof of
revocability. These requirements remain under .17 R4; no duplicate backlog or new priority is created.

## Test and reporting boundary

This inspection does not pass SP-10, SP-11 or the single-task pilot. Contract/schema and documentation
checks remain distinct from execution qualification. Beads .17 remains in progress; .13 remains
blocked. Existing reviewed R1–R3 designs remain usable, with implementation waiting at the documented
host feasibility gate. PR275 remains a planning/provisioning record, not a runtime-completion PR.
