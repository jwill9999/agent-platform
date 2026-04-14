'use client';

import { OutputRenderer } from '../../../components/OutputRenderer';

/**
 * E2E-only page: asserts `OutputRenderer` shows contract-shaped `tool_result` in the DOM.
 * Full harness+MCP chat is not wired to the home page yet; this validates the UI path.
 */
export default function E2eVerifyPage() {
  return (
    <main style={{ padding: '1rem', maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>E2E verify</h1>
      <OutputRenderer
        showThinking={false}
        output={{
          type: 'tool_result',
          toolId: 'e2e-fs:read_file',
          data: { ok: true, note: 'fixture' },
        }}
      />
    </main>
  );
}
