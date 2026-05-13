# Task: Define IDE handoff and generated Project side panel

**Beads issue:** `agent-platform-electron-stabilisation.11`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.11.md`

## Summary

Define the next-step design for manual file editing and agent-created Projects. The app should avoid
rebuilding a full IDE during stabilisation, while still supporting read-only file/context views,
generated file visibility, preview surfaces, and explicit handoff to the user's preferred IDE.

## Requirements

- Document whether the built-in IDE is removed, hidden, or experimental for the current release.
- Define an "Open in IDE" handoff to the user's configured/default editor.
- Define how generated Projects are created, named, stored, and shown to the user.
- Define how chat surfaces render generated output, such as landing pages, Markdown documents, PDFs,
  and HTML previews, without requiring users to navigate into the file system.
- Define what the right-side activity panel should show for changed files, tests, CI, review
  comments, and previews.
- Identify implementation research still needed.

## Implementation Plan

1. Review current IDE surface dependencies and determine what can be removed from primary nav safely.
2. Specify local IDE handoff options and platform risks for macOS first.
3. Specify generated Project storage and display rules.
4. Specify rendered preview behavior for chat surfaces, including HTML/app previews,
   Markdown/document previews, PDF previews, and safe fallback states.
5. Specify right-side panel states for code changes, generated previews, tests, and CI.
6. Create follow-up implementation tasks if the design reveals more than one workstream.

## Tests And Verification

- Documentation/spec review.
- Follow-up Beads tasks created for implementation work.
- Manual QA checklist updated if user-facing flows change.

## Definition Of Done

- Product decision for built-in IDE handling is documented.
- External/default IDE handoff behavior is specified.
- Generated Project side-panel behavior is specified.
- Rendered preview behavior is specified for generated HTML/app, Markdown/document, and PDF output.
- Any remaining implementation research is explicitly tracked.
