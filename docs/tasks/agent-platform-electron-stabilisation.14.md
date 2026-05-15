# Task: Support common chat attachments

**Beads issue:** `agent-platform-electron-stabilisation.14`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.14.md`  
**Parent epic:** `agent-platform-electron-stabilisation` - Electron stabilisation and manual QA triage

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-electron-stabilisation.14.md`

## Summary

Fix the manual QA finding where dropping or attaching a PNG/JPEG screenshot in chat is rejected as
an unsupported text format. Chat should accept common attachment types and present them as
attachments instead of treating every file as text.

## Manual QA Finding

- **Finding:** Chat rejects `.png` and `.jpg` files with text-format errors.
- **Finding:** A skipped attachment can remain visible when starting a new Chat or switching between
  Chat and Project Chat.
- **Severity:** high.
- **Classification:** stabilisation regression/follow-up.
- **Expected:** Users can attach common image formats such as PNG/JPEG/WebP and common document/text
  files such as Markdown from Personal Chat and Project Chat. The UI should show the attachment
  clearly and either include it in the model request when the selected model/profile supports that
  content type or explain that the selected model/profile cannot use it.

## Requirements

- Accept common image attachments: `.png`, `.jpg`, `.jpeg`, `.webp`, and `.gif` where supported.
- Continue accepting common text/document attachments such as `.txt`, `.md`, `.json`, `.csv`, and
  other already-supported source/document formats.
- Do not route image files through the text-file parser.
- Show attachments in the composer with user-facing file names and safe size/type metadata.
- If the selected model/profile supports images, include the image in the chat request through the
  appropriate multimodal message contract.
- If the selected model/profile does not support images, keep the attachment visible and show a
  clear unsupported-model state before send.
- Clear unsent/skipped attachment state when starting a new Chat, opening a Project Chat, or
  switching between Personal Chat and Project Chat unless the user explicitly keeps a draft.
- Enforce file size and MIME/type validation.
- Never expose host absolute paths in normal attachment UI.

## Implementation Plan

1. Audit current attachment parsing and chat request contracts.
2. Add an explicit attachment type model for text, image, document, and unsupported files.
3. Update the composer to accept and render image/document attachments separately from text parsing
   failures.
4. Wire supported attachments into the model request path only when the selected profile supports
   them.
5. Add fallback copy for unsupported model/profile combinations.
6. Add draft reset tests for new Chat, Project Chat, and route switches.
7. Add tests for drag/drop, file picker attachments, unsupported formats, size limits, and send
   behavior.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused component tests for attachment acceptance, unsupported states, and draft reset.
- API/contract tests for multimodal attachment payloads where applicable.
- Electron/Playwright: attach a PNG/JPEG screenshot and Markdown file in Personal Chat and Project
  Chat, verify accepted attachments are displayed without text-format errors, and verify skipped
  attachments do not leak into a new Chat.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] PNG/JPEG/WebP image attachments are accepted in chat.
- [ ] Common text/document attachments such as Markdown remain accepted.
- [ ] Image attachments are not parsed as text files.
- [ ] Skipped/unsent attachments do not leak between new Chat, Personal Chat, and Project Chat.
- [ ] Unsupported model/profile states are clear before send.
- [ ] Host absolute paths are hidden from attachment UI.
- [ ] Tests and CI/CD gates pass before the Beads task is closed.
