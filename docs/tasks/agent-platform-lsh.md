# agent-platform-lsh — Port layout shell, sidebar, theme

**Epic:** agent-platform-o63 (Frontend V0 Integration)
**Branch:** `task/agent-platform-lsh` → chains from `task/agent-platform-fdu`

## Summary

Port the V0 reference layout shell (sidebar navigation, theme toggle, app
shell wrapper) into `apps/web`, replacing the old inline-styled `AppNav`.
Adds light/dark/system theme support via `next-themes`.

## Changes

| File                                             | What                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `apps/web/package.json`                          | Added `@radix-ui/react-dropdown-menu`, `@radix-ui/react-slot`            |
| `apps/web/components/ui/button.tsx`              | New — shadcn Button (cva variants)                                       |
| `apps/web/components/ui/dropdown-menu.tsx`       | New — shadcn DropdownMenu (radix)                                        |
| `apps/web/components/layout/sidebar-context.tsx` | New — SidebarProvider + useSidebar hook                                  |
| `apps/web/components/layout/sidebar.tsx`         | New — collapsible sidebar with all nav routes                            |
| `apps/web/components/layout/theme-toggle.tsx`    | New — light/dark/system theme picker                                     |
| `apps/web/components/layout/app-shell.tsx`       | New — flex layout wrapper (sidebar + main)                               |
| `apps/web/app/layout.tsx`                        | Replaced AppNav with ThemeProvider + AppShell                            |
| `apps/web/app/settings/layout.tsx`               | Simplified — Tailwind classes, removed SettingsNav (sidebar handles nav) |

## Navigation routes

| Sidebar item | Route                   | Matches existing page? |
| ------------ | ----------------------- | ---------------------- |
| Chat         | `/`                     | ✅                     |
| Agents       | `/settings/agents`      | ✅                     |
| Models       | `/settings/models`      | ✅                     |
| Skills       | `/settings/skills`      | ✅                     |
| Tools        | `/settings/tools`       | ✅                     |
| MCP Servers  | `/settings/mcp-servers` | ✅                     |
| Plugins      | `/settings/plugins`     | ✅                     |
| Sessions     | `/settings/sessions`    | ✅                     |

## Definition of Done

- [x] AppShell with collapsible sidebar replaces AppNav
- [x] Theme toggle (light/dark/system) with next-themes
- [x] All existing routes accessible from sidebar
- [x] Button + DropdownMenu shadcn components added
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `pnpm test` passes (55 tests)
- [x] `pnpm build` succeeds
- [x] `pnpm format:check` passes
