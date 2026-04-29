'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
  MessageSquare,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Code2,
  Settings,
  Bot,
  Cpu,
  Wrench,
  Hammer,
  Server,
  Puzzle,
  History,
  FolderOpen,
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

const navigation = [
  {
    name: 'Chat',
    href: '/',
    icon: MessageSquare,
    description: 'Start conversations',
  },
  {
    name: 'IDE',
    href: '/ide',
    icon: Code2,
    description: 'Code with AI assistant',
  },
];

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

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

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
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
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
