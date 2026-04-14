export default function PluginsSettingsPage() {
  return (
    <div>
      <h2 style={{ fontSize: '1.1rem' }}>Plugins</h2>
      <p style={{ fontSize: '0.875rem', color: '#475569', maxWidth: 640 }}>
        Plugin allowlists and defaults are stored on <strong>agents</strong> (<code>pluginAllowlist</code>,{' '}
        <code>pluginDenylist</code>) and enforced by the harness at runtime. There is no dedicated{' '}
        <code>/v1/plugins</code> REST surface yet — use the{' '}
        <a href="/settings/agents" style={{ color: '#2563eb' }}>
          Agents
        </a>{' '}
        JSON editor or the seed data until a plugin registry API exists.
      </p>
    </div>
  );
}
