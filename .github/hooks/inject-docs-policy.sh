#!/usr/bin/env bash
set -euo pipefail

cat <<'JSON'
{
  "continue": true,
  "systemMessage": "Documentation policy: when code, API behavior, security rules, architecture, or tooling changes, update relevant documentation in the same task (for example docs/, README.md, contracts/openapi/, and session.md when applicable)."
}
JSON
