# Task: Support image attachments in chat

**Beads issue:** `agent-platform-electron-stabilisation.14`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.14.md`  
**Parent epic:** `agent-platform-electron-stabilisation` - Electron stabilisation and manual QA triage

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-electron-stabilisation.14.md`

## Summary

Fix the manual QA finding where dropping or attaching a PNG screenshot in chat is rejected as an
unsupported text format. Chat should accept common image attachments and present them as attachments
instead of treating them as text files.

## Manual QA Finding

- **Finding:** Chat rejects `.png` files with: `extension ".png" is not an allowed text format`.
- **Severity:** high.
- **Classification:** stabilisation regression/follow-up.
- **Expected:** Users can attach common image formats such as PNG/JPEG/WebP from Personal Chat and
  Project Chat. The UI should show the image attachment clearly and either include it in the model
  request when the selected model/profile supports images or explain that the selected model cannot
  use image input.

## Requirements

- Accept common image attachments: `.png`, `.jpg`, `.jpeg`, `.webp`, and `.gif` where supported.
- Do not route image files through the text-file parser.
- Show image attachments in the composer with user-facing file names and safe size/type metadata.
- If the selected model/profile supports images, include the image in the chat request through the
  appropriate multimodal message contract.
- If the selected model/profile does not support images, keep the attachment visible and show a
  clear unsupported-model state before send.
- Enforce file size and MIME/type validation.
- Never expose host absolute paths in normal attachment UI.

## Implementation Plan

1. Audit current attachment parsing and chat request contracts.
2. Add an explicit attachment type model for text, image, and unsupported files.
3. Update the composer to accept and render image attachments separately from text attachments.
4. Wire image attachments into the model request path only when supported.
5. Add fallback copy for unsupported model/profile combinations.
6. Add tests for drag/drop, file picker attachments, unsupported formats, size limits, and send
   behavior.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused component tests for image attachment acceptance and unsupported states.
- API/contract tests for multimodal attachment payloads where applicable.
- Electron/Playwright: attach a PNG screenshot in Personal Chat and Project Chat, verify it is
  accepted and displayed without text-format errors.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] PNG/JPEG/WebP image attachments are accepted in chat.
- [ ] Image attachments are not parsed as text files.
- [ ] Unsupported model/profile states are clear before send.
- [ ] Host absolute paths are hidden from attachment UI.
- [ ] Tests and CI/CD gates pass before the Beads task is closed.
