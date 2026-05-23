'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type {
  ProjectDesktopRecentProjectsResult,
  ProjectDesktopRecord,
} from '@agent-platform/contracts';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Settings,
  Bot,
  Cpu,
  Wrench,
  Hammer,
  Server,
  Puzzle,
  History,
  FolderOpen,
  Brain,
  CalendarClock,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from './sidebar-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiDelete, apiGet, apiPath, ApiRequestError } from '@/lib/apiClient';
import {
  buildProjectChatHref,
  desktopProjectIsAvailable,
  desktopProjectSecondaryLabel,
  personalChatModeSearchValue,
  projectReopenRequestedEvent,
  projectReopenSearchParam,
  recentProjectsUpdatedEvent,
  visibleRecentDesktopProjects,
  workspaceHomeRequestedEvent,
  workspaceModeSearchParam,
  workspaceNavigationItems,
  workspacePersonalChatRequestedEvent,
} from '@/lib/project-navigation';

const COLLAPSED_RECENT_PROJECT_COUNT = 4;

const settingsNavigation = [
  {
    name: 'Agents',
    href: '/settings/agents',
    icon: Bot,
    description: 'Configure AI agents',
  },
  {
    name: 'Models',
    href: '/settings/models',
    icon: Cpu,
    description: 'Manage AI models',
  },
  {
    name: 'Skills',
    href: '/settings/skills',
    icon: Wrench,
    description: 'Manage agent skills',
  },
  {
    name: 'Tools',
    href: '/settings/tools',
    icon: Hammer,
    description: 'Configure tools',
  },
  {
    name: 'Workspace',
    href: '/settings/workspace',
    icon: FolderOpen,
    description: 'Inspect files',
  },
  {
    name: 'Memory',
    href: '/settings/memory',
    icon: Brain,
    description: 'Review memories',
  },
  {
    name: 'Scheduler',
    href: '/settings/scheduler',
    icon: CalendarClock,
    description: 'Manage background jobs',
  },
  {
    name: 'MCP Servers',
    href: '/settings/mcp-servers',
    icon: Server,
    description: 'Connect MCP servers',
  },
  {
    name: 'Plugins',
    href: '/settings/plugins',
    icon: Puzzle,
    description: 'Manage plugins',
  },
  {
    name: 'Sessions',
    href: '/settings/sessions',
    icon: History,
    description: 'View sessions',
  },
];

export function RecentProjectsNavSection({
  projects,
  isLoading,
  onRefresh,
  onForgetProject,
}: Readonly<{
  projects: readonly ProjectDesktopRecord[];
  isLoading: boolean;
  onRefresh: () => void;
  onForgetProject?: (project: ProjectDesktopRecord) => void;
}>) {
  const visibleProjects = visibleRecentDesktopProjects(projects);
  const [isExpanded, setIsExpanded] = useState(false);
  const hasOverflow = visibleProjects.length > COLLAPSED_RECENT_PROJECT_COUNT;
  const displayedProjects =
    hasOverflow && !isExpanded
      ? visibleProjects.slice(0, COLLAPSED_RECENT_PROJECT_COUNT)
      : visibleProjects;

  return (
    <section className="mt-5 border-t border-border pt-4" aria-label="Recent Projects">
      <div className="mb-2 flex items-center justify-between gap-2 px-3">
        <div className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recent Projects
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          aria-label="Refresh recent Projects"
          title="Refresh recent Projects"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} aria-hidden />
        </Button>
      </div>
      {visibleProjects.length === 0 ? (
        <p className="px-3 text-xs leading-snug text-muted-foreground">
          {isLoading ? 'Loading Projects...' : 'No recent Projects'}
        </p>
      ) : (
        <div className="space-y-1">
          {displayedProjects.map((project) => {
            const available = desktopProjectIsAvailable(project);
            const folderLabel = desktopProjectSecondaryLabel(project, visibleProjects);
            const content = (
              <>
                <span className="truncate text-sm font-medium">{project.name}</span>
                <span className="truncate text-xs text-muted-foreground">{folderLabel}</span>
                <span
                  className={cn(
                    'text-[11px]',
                    available ? 'text-emerald-600' : 'text-amber-700 dark:text-amber-300',
                  )}
                >
                  {available ? 'Ready to reopen' : 'Open again to reconnect'}
                </span>
              </>
            );

            if (!available) {
              return (
                <div
                  key={project.id}
                  className="group flex items-start gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2"
                >
                  <div
                    className="flex min-w-0 flex-1 cursor-not-allowed flex-col text-left"
                    aria-label={`${project.name} open again to reconnect`}
                  >
                    {content}
                  </div>
                  {onForgetProject && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 opacity-70 hover:opacity-100"
                      aria-label={`Forget ${project.name}`}
                      title={`Forget ${project.name}`}
                      onClick={() => onForgetProject(project)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  )}
                </div>
              );
            }

            return (
              <div key={project.id} className="group flex items-start gap-1 rounded-lg">
                <Link
                  href={buildProjectChatHref(project.id)}
                  className="flex min-w-0 flex-1 flex-col rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title={`Open ${project.name}`}
                  onClick={() => {
                    globalThis.window.dispatchEvent(
                      new CustomEvent(projectReopenRequestedEvent, {
                        detail: { projectId: project.id },
                      }),
                    );
                  }}
                >
                  {content}
                </Link>
                {onForgetProject && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="mt-1 h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Forget ${project.name}`}
                    title={`Forget ${project.name}`}
                    onClick={() => onForgetProject(project)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                )}
              </div>
            );
          })}
          {hasOverflow && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-1 h-8 w-full justify-start px-3 text-xs text-muted-foreground"
              onClick={() => setIsExpanded((value) => !value)}
            >
              {isExpanded
                ? 'Show fewer Projects'
                : `Show ${visibleProjects.length - COLLAPSED_RECENT_PROJECT_COUNT} more`}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function forgetProjectInLocation(projectId: string) {
  const currentProjectId = new URLSearchParams(globalThis.window.location.search).get(
    projectReopenSearchParam,
  );
  if (currentProjectId !== projectId) return;
  globalThis.window.history.pushState(null, '', '/');
  globalThis.window.dispatchEvent(new CustomEvent(workspaceHomeRequestedEvent));
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const [recentProjects, setRecentProjects] = useState<ProjectDesktopRecord[]>([]);
  const [isLoadingRecentProjects, setIsLoadingRecentProjects] = useState(false);
  const [searchString, setSearchString] = useState('');

  const loadRecentProjects = useCallback(async () => {
    setIsLoadingRecentProjects(true);
    try {
      const result = await apiGet<ProjectDesktopRecentProjectsResult>(
        apiPath('projects', 'desktop', 'recent'),
      );
      setRecentProjects(result?.projects ?? []);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) {
        setRecentProjects([]);
        return;
      }
      setRecentProjects([]);
    } finally {
      setIsLoadingRecentProjects(false);
    }
  }, []);

  const forgetRecentProject = useCallback(async (project: ProjectDesktopRecord) => {
    try {
      await apiDelete(apiPath('projects', project.id));
      setRecentProjects((current) => current.filter((candidate) => candidate.id !== project.id));
      forgetProjectInLocation(project.id);
      globalThis.window.dispatchEvent(new Event(recentProjectsUpdatedEvent));
    } catch {
      loadRecentProjects().catch(() => {});
    }
  }, [loadRecentProjects]);

  useEffect(() => {
    if (collapsed) return;
    loadRecentProjects().catch(() => {});
  }, [collapsed, loadRecentProjects]);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    const refresh = () => {
      loadRecentProjects().catch(() => {});
    };
    globalThis.window.addEventListener(recentProjectsUpdatedEvent, refresh);
    return () => {
      globalThis.window.removeEventListener(recentProjectsUpdatedEvent, refresh);
    };
  }, [loadRecentProjects]);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    const syncSearchString = () => {
      setSearchString(globalThis.window.location.search);
    };
    syncSearchString();
    globalThis.window.addEventListener('popstate', syncSearchString);
    return () => {
      globalThis.window.removeEventListener('popstate', syncSearchString);
    };
  }, []);

  const searchParams = new URLSearchParams(searchString);
  const currentMode = searchParams.get(workspaceModeSearchParam);
  const currentProjectId = searchParams.get(projectReopenSearchParam);
  const isRoot = pathname === '/';
  const isPersonalChatSurface =
    isRoot && currentMode === personalChatModeSearchValue && !currentProjectId;
  const shouldShowRecentProjects =
    !collapsed && !isPersonalChatSurface && recentProjects.length > 0;

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-card border-r border-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        {!collapsed && (
          <>
            <div className="overflow-hidden flex-1">
              <h1 className="font-semibold text-foreground truncate">AI Studio</h1>
              <p className="text-xs text-muted-foreground truncate">Agent Platform</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-8 w-8 flex-shrink-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {workspaceNavigationItems.map((item) => {
          const isActive =
            item.surface === 'home'
              ? isRoot && !currentMode && !currentProjectId
              : isRoot && currentMode === personalChatModeSearchValue && !currentProjectId;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => {
                const url = new URL(item.href, globalThis.window.location.href);
                setSearchString(url.search);
                if (item.surface === 'home') {
                  globalThis.window.dispatchEvent(new CustomEvent(workspaceHomeRequestedEvent));
                } else if (item.surface === 'chat') {
                  globalThis.window.dispatchEvent(
                    new CustomEvent(workspacePersonalChatRequestedEvent),
                  );
                }
              }}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}
            >
              <item.icon
                className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary-foreground')}
              />
              {!collapsed && (
                <div className="overflow-hidden">
                  <span className="font-medium truncate block">{item.name}</span>
                  {!isActive && (
                    <span className="text-xs text-muted-foreground truncate block">
                      {item.description}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
        {shouldShowRecentProjects && (
          <RecentProjectsNavSection
            projects={recentProjects}
            isLoading={isLoadingRecentProjects}
            onRefresh={loadRecentProjects}
            onForgetProject={forgetRecentProject}
          />
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between')}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn('h-9 rounded-lg', collapsed ? 'w-9 px-0' : 'gap-2 px-3')}
                aria-label="Open settings menu"
                title="Open settings menu"
              >
                <Settings className="h-4 w-4" />
                {!collapsed && <span className="text-sm">Settings</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={collapsed ? 'start' : 'end'}>
              <DropdownMenuLabel>Configuration</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {settingsNavigation.map((item) => {
                const isActive = pathname.startsWith(item.href);

                return (
                  <DropdownMenuItem
                    key={item.name}
                    asChild
                    className={isActive ? 'bg-secondary' : ''}
                  >
                    <Link href={item.href} className="flex w-full items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
          {collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-9 w-9"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
