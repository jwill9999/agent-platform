#!/usr/bin/env bash
set -euo pipefail

cat <<'JSON'
{
  "continue": true,
  "systemMessage": "Documentation policy: When code, API behavior, security rules, architecture, or tooling changes, update relevant documentation in the same task (for example docs/, README.md, contracts/openapi/, and session.md when applicable). Follow these steps: 1) Summarize the implemented change in one paragraph. 2) Scan repository docs (docs/, README.md, contracts/openapi/, session.md, package README files) and identify gaps: public API changes, new or changed env vars, CLI flags, deployment steps, architectural decisions, or security considerations that are not documented. 3) For each undocumented item, either update the appropriate documentation file or append a clear TODO entry to session.md containing the suggested documentation text and the target file path. 4) If you cannot confidently update a doc, create a TODO in session.md listing the exact information required. 5) At completion, include a concise checklist of updated files and TODOs in the final message."
}
JSON
