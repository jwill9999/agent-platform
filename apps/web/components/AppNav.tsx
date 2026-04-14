import Link from 'next/link';

export function AppNav() {
  return (
    <nav
      aria-label="Main"
      style={{
        display: 'flex',
        gap: '1rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
        marginBottom: '1rem',
      }}
    >
      <Link href="/" style={{ fontWeight: 600, color: '#0f172a' }}>
        Chat
      </Link>
      <Link href="/settings/skills" style={{ color: '#334155' }}>
        Settings
      </Link>
    </nav>
  );
}
