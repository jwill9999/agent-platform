import { KeyRound, Bot, Terminal, ShieldAlert } from 'lucide-react';

export default function ModelsSettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border bg-card/50">
        <h1 className="text-xl font-semibold text-foreground">Models &amp; Keys</h1>
        <p className="text-sm text-muted-foreground">
          Configure model providers and API key resolution
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-4">
          <InfoCard
            icon={<KeyRound className="h-5 w-5 text-primary" />}
            title="Chat (Next.js)"
          >
            Set <code className="text-xs bg-muted px-1 py-0.5 rounded">NEXT_OPENAI_API_KEY</code> in{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">apps/web/.env</code> for the{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/chat</code> route.
          </InfoCard>

          <InfoCard
            icon={<Bot className="h-5 w-5 text-primary" />}
            title="Per-agent override"
          >
            Edit <code className="text-xs bg-muted px-1 py-0.5 rounded">modelOverride</code> on an agent (provider + model) in{' '}
            <a href="/settings/agents" className="text-primary hover:underline">Agents</a>.
            Keys are not stored in the agent row — use environment / provider defaults.
          </InfoCard>

          <InfoCard
            icon={<Terminal className="h-5 w-5 text-primary" />}
            title="API streaming"
          >
            <code className="text-xs bg-muted px-1 py-0.5 rounded">POST /v1/chat/stream</code> accepts{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">x-openai-key</code> or{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">AGENT_OPENAI_API_KEY</code> on the API process.
          </InfoCard>

          <InfoCard
            icon={<ShieldAlert className="h-5 w-5 text-primary" />}
            title="Legacy env guard"
          >
            Legacy <code className="text-xs bg-muted px-1 py-0.5 rounded">OPENAI_API_KEY</code> is blocked by default.
            Set <code className="text-xs bg-muted px-1 py-0.5 rounded">OPENAI_ALLOW_LEGACY_ENV=1</code> only if you intentionally want the legacy variable.
          </InfoCard>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, children }: Readonly<{ icon: React.ReactNode; title: string; children: React.ReactNode }>) {
  return (
    <div className="flex gap-4 p-4 rounded-xl border border-border bg-card">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
