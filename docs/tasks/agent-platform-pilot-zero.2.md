# Read-only preapproval planner and critic source

Beads: `agent-platform-pilot-zero.2`  
Parent: `agent-platform-pilot-zero`

## Requirements

Independent supervised critique found that the low-level container launcher always mounted source
writable and selected the workspace-write sandbox, even for the read-only planner and critic roles.
For `feature_planner` and `plan_critic`, enforce a read-only source mount and read-only Codex sandbox.
Preserve implementation-worker behavior and existing private mounts, environment restrictions and
network checks. Do not weaken active-run credential requirements.

## Implementation plan

Derive the two read-only role settings inside the launch builder, not from a caller-supplied mode.
Add regression assertions for both roles and unchanged implementation behavior. This is only one
prerequisite of a future preapproval review runner: dedicated authentication, exact-material results,
bounded cleanup, pinned image and verified egress remain separate requirements.

## Dependency order

Branch from `task/pilot-zero-test-build`; cumulative segment tip targets
`feature/pilot-zero-assessment`. No dependency on successful live credential provisioning is needed
to implement and test this launch restriction. Beads remains open until segment-tip delivery gates.

## Tests and definition of done

Focused launcher tests assert both mount modes and sandbox arguments, preserving worker writes.
Run build, typecheck, lint, formatting, package tests and Sonar analysis or documented fallback.
Obtain independent review, push and pass hosted checks before segment-tip integration and closure.
The existing real Docker isolation probe is separate and does not prove this exact Codex command's
live model execution. No application UI changes are included.

## Sign-off

Owner: Jason Williams. Review is supervised bootstrap review, not isolated-runtime acceptance.
This task does not authorize production/staging merge or claim a complete critic execution path.
