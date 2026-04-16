import { Puzzle } from 'lucide-react';

export default function PluginsSettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border bg-card/50">
        <h1 className="text-xl font-semibold text-foreground">Plugins</h1>
        <p className="text-sm text-muted-foreground">Plugin lifecycle hooks and configuration</p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Puzzle className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-foreground mb-2">No plugin registry yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Plugin allowlists and defaults are stored on{' '}
            <a href="/settings/agents" className="text-primary hover:underline">agents</a>{' '}
            (<code className="text-xs bg-muted px-1 py-0.5 rounded">pluginAllowlist</code>,{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">pluginDenylist</code>) and enforced by the harness at runtime.
          </p>
        </div>
      </div>
    </div>
  );
}
