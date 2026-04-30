# Coding Runtime Baseline

The coding runtime baseline defines which command-line tools are expected inside the API container for coding-agent workflows, and how agents should access those capabilities safely.

The typed tool contract, evidence envelope, audit shape, and artifact rules are defined in [Coding Tool Contracts](coding-tool-contracts.md).

## Required CLI Baseline

| Command | Purpose                                                           | Access model                                                 |
| ------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `git`   | Repository inspection and later governed source-control workflows | Prefer typed git tools; shell fallback remains high-friction |
| `rg`    | Fast code search                                                  | Prefer typed repository search tools                         |
| `jq`    | JSON inspection and transformations                               | Shell fallback allowed for low-risk local data inspection    |
| `make`  | Project quality and lifecycle targets                             | Prefer governed test/build runner                            |
| `node`  | Runtime for platform scripts                                      | Available for runtime scripts                                |
| `pnpm`  | Workspace package scripts                                         | Prefer governed test/build runner; installs require approval |
| `diff`  | Text diff inspection                                              | Prefer structured edit/git diff tools                        |
| `file`  | File type inspection                                              | Low-risk read-only utility                                   |
| `wc`    | Size/count inspection                                             | Low-risk read-only utility                                   |
| `sed`   | Text inspection/transformation                                    | Shell use remains policy-scored                              |
| `awk`   | Text inspection/transformation                                    | Shell use remains policy-scored                              |

The API runner image installs this baseline. Verify a running compose stack with:

```bash
make coding-runtime-verify
```

The underlying script is:

```bash
node scripts/coding-runtime-verify.mjs
```

## Policy

Preinstalling CLIs does not mean unrestricted CLI execution. Common coding actions should move into typed harness tools so the platform can enforce policy, capture structured evidence, and present useful output to users.

```json
{
  "policy": {
    "read_only_inspection": "low",
    "workspace_edits": "medium",
    "test_or_build_runs": "medium",
    "dependency_install": "high_requires_approval",
    "git_commit": "high_requires_approval",
    "git_push": "high_requires_approval",
    "deploy_or_cloud_cli": "critical_requires_approval"
  }
}
```

## Typed Wrapper Plan

| Capability            | Target task                   | Notes                                                      |
| --------------------- | ----------------------------- | ---------------------------------------------------------- |
| Structured edits      | `agent-platform-code-tools.3` | Prefer deterministic patch/edit tool over shell writes     |
| Git status/diff/log   | `agent-platform-code-tools.4` | Read-only typed wrappers around `git`                      |
| Test/build runner     | `agent-platform-code-tools.5` | Allowlisted profiles, timeout, structured failure evidence |
| Repository map/search | `agent-platform-code-tools.6` | Use `rg` and filesystem inspection behind bounded outputs  |

All wrappers return the shared coding evidence envelope documented in [Coding Tool Contracts](coding-tool-contracts.md) so critic, Definition-of-Done checks, audit logs, and UI rendering can consume a consistent shape.

## Runtime Boundary

- Coding tools must respect the workspace and repository boundaries defined by PathJail.
- Shell access remains high risk when commands mutate files, install dependencies, commit, push, or deploy.
- Tool outputs should be truncated, structured, and usable by critic/Definition-of-Done checks.
- Future cloud or GitHub CLIs such as `gh` should be added only with explicit credential and approval policy.
