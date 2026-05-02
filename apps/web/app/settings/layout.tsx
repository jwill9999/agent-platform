import type { ReactNode } from 'react';

export default function SettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold text-foreground mb-1">Configuration</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Manage agents, models, skills, tools, memory, and MCP servers.
        </p>
        {children}
      </div>
    </div>
  );
}
