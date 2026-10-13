# Task: Investigate drafts during initial Personal session creation

**Beads issue:** `agent-platform-initial-session-draft`  
**Discovered from:** `agent-platform-sizx`; independent, nonblocking follow-up.

## Summary and evidence

PR314 source review found that the Chat component is keyed by session ID. The initial
null-to-bound transition can therefore remount its composer, while drafting is allowed before
submission readiness. A lost draft at this boundary has not been dynamically demonstrated.
Do not label the hypothesis as a confirmed defect or confuse it with same-session refusal.

The separate diagnostic-export fixture failure was reproduced with an empty session, no messages
or diagnostic events and a fast404 response. Waiting for real admission and a completed reply is
the fixture correction; it does not prove or repair this draft-continuity hypothesis.

## Requirements and implementation plan

First reproduce or disprove the hypothesis using controlled initial session creation. Observe the
actual mounted UI and a browser journey, retaining the draft, session transition and send effects.
If confirmed, propose a bounded correction before implementation. Preserve intentional navigation
resets; do not introduce cross-session draft storage, automatic submission or request replay.

## Tests and definition of done

Verify text and attachment behavior before initial readiness and after session binding, and compare
with normal intentional navigation. Premature submission must remain refused. Record source-bound
evidence and the confirmed disposition in Beads; implementation, if needed, requires affected tests,
independent review and the normal delivery gates. This investigation is not part of PR314's
same-session restoration acceptance and does not reopen paused orchestration.
