# agent-platform-fdu — Upgrade deps + Tailwind/shadcn foundation

**Epic:** agent-platform-o63 (Frontend V0 Integration)
**Branch:** `task/agent-platform-fdu` → `feature/frontend-v0`

## Summary

Add Tailwind CSS v4 and shadcn/ui tooling to `apps/web` as the design-system
foundation for porting the V0 reference UI. Core deps (Next.js 15, AI SDK v4)
remain unchanged — they match `model-router` and `harness`.

## Changes

| File                          | What                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/package.json`       | Added Tailwind v4, postcss, shadcn utils (clsx, cva, tailwind-merge, lucide-react, next-themes, sonner, react-markdown, remark-gfm) |
| `apps/web/postcss.config.mjs` | New — `@tailwindcss/postcss` plugin                                                                                                 |
| `apps/web/components.json`    | New — shadcn config (new-york style, neutral base, RSC, lucide)                                                                     |
| `apps/web/tsconfig.json`      | Added `@/*` path alias for shadcn component imports                                                                                 |
| `apps/web/app/globals.css`    | Replaced with Tailwind v4 theme: OKLch CSS vars, dark mode, sidebar tokens                                                          |
| `apps/web/lib/cn.ts`          | New — `cn()` utility (clsx + tailwind-merge)                                                                                        |

## Decisions

- **Keep AI SDK v4 / Next.js 15** — model-router and harness are on v4; upgrading
  the entire AI SDK chain is a separate concern (future task or part of `cht`).
- **`@/*` path alias** — standard shadcn convention; coexists with monorepo
  `@agent-platform/*` workspace packages.
- **OKLch color variables** — from V0 reference; perceptually uniform color space
  with light/dark mode support.

## Definition of Done

- [x] Tailwind v4 + PostCSS configured
- [x] shadcn components.json present
- [x] globals.css has full theme (light + dark + sidebar tokens)
- [x] `cn()` utility available
- [x] `@/*` path alias configured
- [x] `pnpm typecheck` passes (all packages)
- [x] `pnpm lint` passes
- [x] `pnpm test` passes (55 tests)
- [x] `pnpm build` succeeds (web app builds with Tailwind)
- [x] No existing functionality broken
