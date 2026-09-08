# Prepare the isolated Codex authentication mountpoint

Beads: `agent-platform-pilot-zero.4`  
Parent: `agent-platform-pilot-zero`

## Requirements and reproduction

A real Docker Desktop probe using generated mounts failed before startup: the nested destination
`/codex-home/auth.json` did not exist inside the writable home mount. Creating an empty destination
file fixed startup for both planner and critic roles; each denied writes to the source mount.
No real authentication was used: the mounted fixture contained only an empty JSON object.

## Implementation plan

Create an owner-only empty JSON placeholder during private workspace preparation. The real model
authentication file remains a separate read-only bind mount; never copy it into this placeholder.
Keep exclusive creation so existing data cannot be overwritten. Add unit and opt-in real Docker
coverage for the production-generated mount layout.

## Dependency order

Independent of exact-material staging; the cumulative Git segment will follow
`task/pilot-zero-material`. Delivery targets the existing pilot-zero assessment feature branch.
No deployment, real model authentication or protected-branch merge is included.

## Tests and definition of done

Workspace preparation test verifies the empty placeholder. Real network-disabled containers using
generated planner/critic mount arguments must start, read permitted source and deny source writes.
Run build, focused tests, typecheck, lint, Sonar or documented fallback, review and hosted gates.
Do not describe an offline Node probe as Codex/model conformance. Keep Beads open until integration.

## Sign-off

Supervised pilot-zero defect discovered through an actual container probe, not model execution.
Owner: Jason Williams. Independent review required before completion.
