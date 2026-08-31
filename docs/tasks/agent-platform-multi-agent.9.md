# Task: Integrate closeout and fault-recovery verification

**Beads issue:** `agent-platform-multi-agent.9`  
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Integrate the full control plane and prove finalization, closeout, and recovery across every local and
external boundary.

## Requirements

- Integrate planning, authorization, persistence, scheduling, loops, brokers, QA, and evidence.
- Keep `finalizing` non-terminal until merge, epic close, Dolt sync, and final evidence are verified.
- Persist and obey exact recovery targets; post-merge recovery cannot schedule tasks.
- Produce a compact acceptance-to-evidence final report.
- Exercise cancellation, polling, absolute wait expiry, escalation, and restart.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.8`.
- **Downstream:** `agent-platform-multi-agent.10`.
- **Branch parent:** `task/agent-platform-multi-agent.8`.

## Implementation plan

1. Build integrated workflow fixtures and external-adapter fakes.
2. Add fault injection before/after every persistent or external effect.
3. Implement finalizing, epic close, Dolt verification, and report generation.
4. Run cumulative security, recovery, and delivery gates.

## Tests and verification

- Prove no duplicate/lost effects across Git, GitHub, Beads, Dolt, artifacts, waits, and finalization.
- Prove absolute wait expiry escalates once and post-merge recovery never schedules work.
- Run full build, typecheck, lint, format, unit/integration/E2E suites, and Sonar analysis.

## Definition of done

- [x] Integrated recovery and closeout contract passes every injected boundary failure.
- [x] Intermediate integration gate and brokered close pass.

## Sign-off

**Owner:** Integration implementation worker  
**Reviewer:** Independent recovery and delivery reviewers
