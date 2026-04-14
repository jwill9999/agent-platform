import type { ReactNode } from 'react';

import { SettingsNav } from '../../components/settings/SettingsNav';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Configuration</h1>
      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
        CRUD against the HTTP API via the Next.js proxy (<code>/api/v1</code> →{' '}
        <code>API_PROXY_URL</code>). Run <code>apps/api</code> on port 3000 in dev.
      </p>
      <SettingsNav />
      {children}
    </div>
  );
}
