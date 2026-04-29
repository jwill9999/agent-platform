import Link from 'next/link';

const links = [
  { href: '/settings/skills', label: 'Skills' },
  { href: '/settings/mcp-servers', label: 'MCP servers' },
  { href: '/settings/agents', label: 'Agents' },
  { href: '/settings/tools', label: 'Tools' },
  { href: '/settings/workspace', label: 'Workspace' },
  { href: '/settings/sessions', label: 'Sessions' },
  { href: '/settings/plugins', label: 'Plugins' },
  { href: '/settings/models', label: 'Models' },
] as const;

export function SettingsNav() {
  return (
    <nav aria-label="Settings sections" style={{ paddingBottom: '1rem' }}>
      <ul
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1rem',
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} style={{ color: '#2563eb' }}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
