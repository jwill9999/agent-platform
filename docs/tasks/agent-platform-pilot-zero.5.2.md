# Enforce generated launch provenance

Beads: `agent-platform-pilot-zero.5.2`

## Requirements

PR260 review identified that lifecycle syntax validation does not enforce its generated-launch
precondition. Only tests currently call the helper, but manually constructed objects can supply
unsafe Docker options. Enforce builder provenance before any Docker subprocess, not a duplicate
independent Docker policy parser. This is not proof that arbitrary caller roots are private staging.

## Implementation

Register a deeply immutable generated launch snapshot in a private module registry at the builder.
Lifecycle requires the exact registered object and executes its stored snapshot. Reject fabrications,
clones and post-build option substitution. Do not expose a production register-any-launch capability.
Keep trusted staging composition as an explicit precondition; no model input chooses host paths.

Adapt offline probes using the real builder with temporary dedicated source/auth/config/prompt
fixtures and a harmless fake codex executable mounted in that source, or an equivalently bounded
test-only mechanism. The actual lifecycle executor and Docker daemon must remain real. Keep network
none, non-root, all hardening and no real credentials. Do not add a production policy bypass for tests.

## Dependencies, verification and done

Follow-up to .5 on PR260; separate files from .6 output validator. Add forgery/clone/mutation tests
and preserve lifecycle faults and real success/timeout/cancel probes. Run build/typecheck/lint,
focused/full package, formatting, independent review, and hosted gates. Reply to the review with
evidence and precise limits before resolving it. No protected merge or live runtime activation is
implied. Independent source review identified this as a precondition gap, not a proved remote escape.

## Verification evidence

The builder now registers and freezes the launch; the lifecycle only consumes the exact registered
object. Fifty-two lifecycle unit tests and six launcher tests pass. Three real offline Docker
probes use the real builder and a harmless mounted fixture executable, with no registration bypass.
Build, typecheck and lint pass. Independent source review returned no actionable findings. Full
package passed 648 tests with seven opt-in skips before four additional forgery tests, which passed
in the final focused run. Final pre-push and updated hosted checks remain publication gates. Private staging ownership and online
egress policy still require trusted composition; the registry does not establish either by itself.
