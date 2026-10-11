'use client';

import { useId, useState } from 'react';
import {
  buildPartialDiagnosticReport,
  projectDiagnosticReport,
  DiagnosticScopeSchema,
  type DiagnosticScope,
  type DiagnosticPartialFailure,
  type DesktopWorkspaceExportResult,
} from '@agent-platform/contracts';
import { Button } from '@/components/ui/button';

type DiagnosticBridge = {
  saveReport: (scope: DiagnosticScope) => Promise<DesktopWorkspaceExportResult>;
  savePartial: (failure: DiagnosticPartialFailure) => Promise<DesktopWorkspaceExportResult>;
};
function bridge(): DiagnosticBridge | undefined {
  return (
    globalThis as typeof globalThis & { agentPlatformDesktop?: { diagnostics?: DiagnosticBridge } }
  ).agentPlatformDesktop?.diagnostics;
}

export function DiagnosticExportAction({
  sessionId,
  requestId,
  failure,
}: Readonly<{
  sessionId: string | null;
  requestId?: string | null;
  failure?: DiagnosticPartialFailure | null;
}>) {
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const scope = DiagnosticScopeSchema.safeParse(requestId ? { requestId } : { sessionId });
  if (!scope.success && !failure) return null;

  async function exportReport() {
    if (busy) return;
    setBusy(true);
    setStatus('');
    try {
      const desktop = bridge();
      if (desktop) {
        const result = failure
          ? await desktop.savePartial(failure)
          : await desktop.saveReport(scope.data!);
        setStatus(
          result.status === 'cancelled'
            ? 'Export cancelled. No report was saved.'
            : 'Diagnostic report saved locally. Attach it to your support ticket if you choose.',
        );
        return;
      }
      let report;
      if (failure) report = buildPartialDiagnosticReport(failure);
      else {
        const response = await fetch('/api/diagnostics/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: scope.data }),
        });
        if (!response.ok) throw new Error('unavailable');
        report = projectDiagnosticReport(await response.json());
      }
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2) + '\n'], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'diagnostic-report.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Diagnostic report download started. Nothing was sent to support.');
    } catch {
      setStatus(
        'Diagnostics could not be exported. History requires the local desktop or a configured loopback connection. Check the connection and save location, then retry.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Diagnostic report" className="mx-auto max-w-3xl px-4 py-2 text-xs">
      <p id={descriptionId} className="text-muted-foreground">
        Save safe technical metadata locally for manual sharing. No messages, file contents or
        credentials are included. Nothing is sent automatically.
      </p>
      {failure && (
        <p>Partial current-view report: unverified and not retained after this view closes.</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        aria-describedby={descriptionId}
        onClick={() => void exportReport()}
      >
        {busy ? 'Preparing diagnostic report…' : 'Export diagnostic report'}
      </Button>
      <p role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
