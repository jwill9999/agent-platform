#\!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

changed="$(git diff --name-only HEAD 2>/dev/null || true)"
staged="$(git diff --cached --name-only 2>/dev/null || true)"
all="${changed}"$'\n'"${staged}"

if \! echo "${all}" | grep -qE '\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml)$'; then
  echo "No relevant changed files. Quality gate passed."
  exit 0
fi

echo "Running strict fallback quality gate..."
pnpm -s typecheck
pnpm -s lint

echo "Quality gate passed."
exit 0
