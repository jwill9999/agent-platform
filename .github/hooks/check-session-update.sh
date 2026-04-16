#!/usr/bin/env bash
# Hook: check whether session.md needs updating before the agent stops.
# Output is read by the Copilot agent — keep it clear and actionable.
# Loop guard: if session.md is already dirty, the agent already updated it.
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

# --- Loop guard: skip if session.md was already modified this session ---
session_dirty=$(git diff --name-only HEAD -- session.md 2>/dev/null || true)
session_staged=$(git diff --cached --name-only -- session.md 2>/dev/null || true)

if [[ -n "$session_dirty" ]] || [[ -n "$session_staged" ]]; then
  echo "session.md already updated this session. No further action needed."
  exit 0
fi

# --- Detect significant work ---
changed_files=$(git diff --name-only HEAD 2>/dev/null || true)
staged_files=$(git diff --cached --name-only 2>/dev/null || true)
untracked_files=$(git ls-files --others --exclude-standard 2>/dev/null || true)

all_changes="${changed_files}${staged_files}${untracked_files}"

# Significance criteria — at least one must be true to trigger an update:
#   1. Source code changed    (apps/ or packages/)
#   2. Task specs changed     (docs/tasks/)
#   3. New commits on branch  (ahead of origin)
#   4. Beads issues modified  (.beads/)

has_code_changes=false
has_task_changes=false
has_new_commits=false
has_beads_changes=false

if echo "$all_changes" | grep -qE '^(apps/|packages/)'; then
  has_code_changes=true
fi

if echo "$all_changes" | grep -qE '^docs/tasks/'; then
  has_task_changes=true
fi

ahead=$(git rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo "0")
if [[ "$ahead" -gt 0 ]]; then
  has_new_commits=true
fi

if echo "$all_changes" | grep -qE '^\.beads/'; then
  has_beads_changes=true
fi

if $has_code_changes || $has_task_changes || $has_new_commits || $has_beads_changes; then
  echo "ACTION REQUIRED: Update session.md before ending this session."
  echo ""
  echo "Changes detected:"
  $has_code_changes   && echo "  - Source code modified in apps/ or packages/"
  $has_task_changes   && echo "  - Task specs modified in docs/tasks/"
  $has_new_commits    && echo "  - $ahead new commit(s) ahead of origin"
  $has_beads_changes  && echo "  - Beads issues modified in .beads/"
  echo ""
  echo "Instructions:"
  echo "  1. Read the current session.md"
  echo "  2. Update 'Last updated' with today's date and a one-line session summary"
  echo "  3. Rewrite 'What happened' to reflect this session's work"
  echo "  4. Update 'Current state' with epic/task status and git branch info"
  echo "  5. Update 'Next' with prioritised next steps"
  echo "  6. Keep it concise — this is an agent handoff document"
else
  echo "No significant changes detected. session.md update not required."
fi
