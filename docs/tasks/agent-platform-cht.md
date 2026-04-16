# agent-platform-cht — Port Chat Interface + Wire to Backend

**Epic:** agent-platform-o63 (Frontend V0 Integration)
**Branch:** `task/agent-platform-cht` → chains from `task/agent-platform-lsh`
**Segment tip:** Yes — PR goes to `feature/frontend-v0`

## Goal

Port the V0-generated chat components into the existing web app, adapting
AI SDK v6 patterns to the v4 API already used by the backend.

## Deliverables

| #   | Item                                 | File(s)                          |
| --- | ------------------------------------ | -------------------------------- |
| 1   | Markdown renderer                    | `components/chat/markdown.tsx`   |
| 2   | Message bubble (user / assistant)    | `components/chat/message.tsx`    |
| 3   | Chat input with auto-resize          | `components/chat/chat-input.tsx` |
| 4   | Main chat view with empty state      | `components/chat/chat.tsx`       |
| 5   | Wire page.tsx to new Chat components | `app/page.tsx`                   |

## Key Decisions

- **AI SDK v4 retained** — upgrading to v6 would break model-router & harness.
- `useChat` v4 provides `input`, `handleInputChange`, `handleSubmit`, `append`.
  Page uses `append()` to send user messages directly (avoids setInput race).
- ReactMarkdown v10 doesn't accept `className` directly — wrapped in a `<div>`.
- `react-syntax-highlighter` with `oneDark` theme for code blocks.

## Sign-off Checklist

- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes (max-warnings 0)
- [x] `pnpm build` succeeds
- [x] `pnpm test` — 55 tests pass
- [x] `pnpm format:check` passes
- [ ] PR created: `task/agent-platform-cht` → `feature/frontend-v0`
- [ ] CI green + SonarCloud clean
- [ ] `bd close agent-platform-cht`
