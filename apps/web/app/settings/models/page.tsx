export default function ModelsSettingsPage() {
  return (
    <div>
      <h2 style={{ fontSize: '1.1rem' }}>Models &amp; keys</h2>
      <ul style={{ fontSize: '0.875rem', color: '#475569', maxWidth: 640, lineHeight: 1.6 }}>
        <li>
          <strong>Chat (Next.js):</strong> set <code>NEXT_OPENAI_API_KEY</code> in <code>apps/web/.env</code> for the{' '}
          <code>/api/chat</code> route (same as the API&apos;s key for OpenAI streaming).
        </li>
        <li>
          <strong>Per-agent override:</strong> edit <code>modelOverride</code> on an agent (provider + model) in{' '}
          <a href="/settings/agents" style={{ color: '#2563eb' }}>
            Agents
          </a>.{' '}
          Keys are not stored in the agent row — use environment / provider defaults.
        </li>
        <li>
          <strong>API streaming:</strong> <code>POST /v1/chat/stream</code> accepts <code>x-openai-key</code> or{' '}
          <code>AGENT_OPENAI_API_KEY</code> on the API process.
        </li>
        <li>
          <strong>Shell exports:</strong> legacy <code>OPENAI_API_KEY</code> is blocked by default (to avoid accidental
          inherited exports). Set <code>OPENAI_ALLOW_LEGACY_ENV=1</code> only if you intentionally want the legacy
          variable.
        </li>
      </ul>
    </div>
  );
}
