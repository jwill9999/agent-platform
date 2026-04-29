# Task: Define coding runtime baseline and CLI policy

**Beads id:** `agent-platform-code-tools.1`  
**Parent epic:** `agent-platform-code-tools` - Structured coding tool pack

## Summary

Define the runtime contract for coding agents before adding new tools. This task decides which CLI binaries should be present in the container, which actions should be exposed as typed tools, which actions remain shell-only, and which actions require human approval.

## Requirements

- Define the baseline CLI set for coding workflows.
- Classify CLIs by purpose, risk, and access model.
- Decide which operations need typed wrappers instead of raw shell.
- Define installation/runtime verification expectations for Docker images.
- Document how high-risk actions such as dependency installs, commits, pushes, and deploy commands are gated.
- Keep the policy aligned with PathJail, workspace storage, and HITL.

## Proposed Baseline

```json
{
  "baseline_cli": {
    "core": ["git", "rg", "jq", "make", "node", "pnpm"],
    "inspection": ["diff", "file", "wc", "sed", "awk"],
    "optional_later": ["python", "gh", "tree"]
  },
  "access_model": {
    "typed_tools_preferred": ["git status", "git diff", "git log", "test runners"],
    "shell_fallback": ["diagnostic commands", "repo-specific scripts"],
    "approval_required": ["git commit", "git push", "dependency install", "deployment"]
  }
}
```

## Implementation Plan

1. Inspect current Dockerfiles and CI runtime assumptions.
2. Document required and optional CLI binaries.
3. Define risk tiers for common CLI operation families.
4. Define the verification command that proves the baseline exists in the API runtime image.
5. Update planning docs if the task chain needs different ordering.

## Dependency Order

| Upstream | Downstream                    |
| -------- | ----------------------------- |
| none     | `agent-platform-code-tools.2` |

Beads dependency: `agent-platform-code-tools.2` depends on this task.

## Tests And Verification

- Docs lint passes.
- Runtime baseline verification command is documented.
- Follow-up tasks can reference the policy without redefining CLI access.

## Definition Of Done

- CLI baseline and policy are documented.
- Typed-wrapper candidates are identified.
- High-risk CLI actions have explicit approval policy.
- Runtime verification expectations are clear enough to implement.
- Beads task and spec agree on scope and acceptance criteria.
