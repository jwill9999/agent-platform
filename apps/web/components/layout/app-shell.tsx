'use client';

import { Sidebar } from './sidebar';
import { SidebarProvider, useSidebar } from './sidebar-context';
import { PanelLeft } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: Readonly<AppShellProps>) {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <SidebarExpandTrigger />
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

function SidebarExpandTrigger() {
  const { collapsed, toggle } = useSidebar();
  if (!collapsed) return null;

  return (
    <button
      onClick={toggle}
      title="Expand sidebar"
      className="absolute top-5 left-2 z-40 h-8 w-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
}
