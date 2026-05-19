# agent-platform-e6g — Design in-app Web Explorer handoff

## Problem

Users need to inspect generated web pages, GitHub links, docs, and chat-provided URLs without leaving AI Studio.

## Requirements

- Define the UX and technical route for an in-app Web Explorer.
- Cover generated local landing pages/apps.
- Cover GitHub repository, PR, checks, and action links.
- Cover general chat links and web data links.
- Keep external browser opening as an explicit fallback.
- Avoid implementing a full browser if this task is scoped as design only.

## Acceptance

- A concrete implementation plan exists for Web Explorer routing and containment.
- Future GitHub links can target the in-app explorer when it is available.
- Security and navigation boundaries are documented before implementation.
