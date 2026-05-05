# Operator Artifact Viewer Patterns

This document defines frontend artifact card and viewer patterns for operator experience surfaces.

It is frontend-only. It uses existing artifact data and does not change backend contracts, artifact
contracts, or runtime storage.

## Current Inputs

Current artifact evidence is available through browser tool results:

- `evidence[].id`
- `evidence[].kind`
- `evidence[].label`
- `evidence[].mimeType`
- `evidence[].sizeBytes`
- `evidence[].truncated`
- `evidence[].metadata.workspaceRelativePath`

The frontend maps those fields into artifact cards and in-app viewers. When an artifact does not
include a workspace path, the card must show an unavailable state rather than promising inspection.

## Card Anatomy

Artifact cards should show:

- title or label
- artifact type
- source page/title/context when available
- source URL/path when available
- size
- status: ready, truncated, unavailable
- primary action: inspect in app or download

Raw artifact content should not be copied into chat messages. The viewer should fetch the existing
artifact download/inline URL when available.

## Viewer Patterns

| Artifact type                | Detection                              | Card action | Viewer pattern                                                          |
| ---------------------------- | -------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| Screenshot/image             | `mimeType` starts with `image/`        | Inspect     | Dialog with fit page, fit width, zoom, reset, and scroll.               |
| Snapshot/text/log            | `mimeType` starts with `text/`         | Inspect     | In-app dialog using inline artifact response inside a scrollable frame. |
| JSON/report                  | `mimeType` is `application/json`       | Inspect     | In-app dialog using inline artifact response inside a scrollable frame. |
| Generated/download-only file | Any other `mimeType` with download URL | Download    | Explicit download action.                                               |
| Future diff                  | Diff mime/kind once available          | Inspect     | Side-by-side or unified diff shell; no backend assumption in this task. |

## State Rules

- Ready: artifact has a download URL and, when supported, an inline preview URL.
- Truncated: show `Truncated` in card metadata and viewer header.
- Unavailable: no download/preview URL exists; show setup/storage limitation copy.
- Failed: use the surrounding tool/trace failure state; do not create a fake artifact card.
- Empty: no artifact section should render when no artifacts exist.

## Implementation Notes

Current implementation files:

- `apps/web/lib/operator-artifacts.ts`
- `apps/web/components/chat/browser-artifact-previews.tsx`
- `apps/web/lib/browser-tool-results.ts`

The component name remains `BrowserArtifactPreviews` because current data originates from browser
tools, but the internal model is generalized for image, text, JSON, and download-only artifacts.

Future artifact sources should map into the same card/viewer model before rendering.
