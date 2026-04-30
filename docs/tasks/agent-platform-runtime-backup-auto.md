# agent-platform-runtime-backup-auto

## Summary

Add stage-two automation for the local runtime-config backup introduced by
`make runtime-config-backup`.

The current backup is manual. It protects local saved model configs, encrypted
API key refs, agent model assignments, MCP server rows, and agent MCP
assignments, but it can become stale after a user changes model/MCP/agent
settings.

## Requirements

- Automatically refresh the ignored local runtime-config backup after successful
  writes to model configs, agent model assignments, MCP servers, and agent MCP
  assignments.
- Preserve the current security posture: do not decrypt, log, print, or commit
  API keys or encrypted secret material.
- Keep `.agent-platform/backups/runtime-config.sqlite` ignored by Git.
- Avoid refreshing the backup on failed transactions or partial writes.
- Make the behavior observable enough for local troubleshooting without exposing
  secret values.

## Implementation Plan

1. Identify API write paths that mutate `model_configs`, `secret_refs`,
   `agents.model_config_id`, `mcp_servers`, and `agent_mcp_servers`.
2. Extract the backup implementation into a reusable module or invoke the script
   safely after successful mutations.
3. Add an opt-out or failure policy if automatic backup fails, so normal UI
   writes are not silently corrupted.
4. Add targeted tests proving successful writes refresh the backup and failed
   writes do not.
5. Update runtime-config backup documentation with the automatic behavior and
   manual fallback command.

## Tests And Verification

- Unit or integration coverage for at least one model-config write and one MCP
  write triggering a backup refresh.
- Regression coverage that backup refresh does not expose plaintext API keys.
- Manual smoke test:

```bash
make runtime-config-backup
make reset
make runtime-config-restore
make restart
```

## Definition Of Done

- Runtime-config backup refreshes automatically after relevant successful UI/API
  config changes.
- Manual `make runtime-config-backup` remains available.
- Documentation explains both automatic refresh and manual recovery.
- Quality gates pass.
