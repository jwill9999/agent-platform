import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppNav } from '../components/AppNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Platform',
  description: 'Chat (dev)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        <main style={{ padding: '0 1rem 2rem' }}>{children}</main>
      </body>
    </html>
  );
}
