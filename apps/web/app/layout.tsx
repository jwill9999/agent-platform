import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AppShell } from '../components/layout/app-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Platform',
  description: 'AI Studio — Agent Platform',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell>{children}</AppShell>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
