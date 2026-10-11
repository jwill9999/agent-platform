import { localDiagnosticConnection } from '@/lib/local-diagnostics-server';
import { DiagnosticScopeSchema, projectDiagnosticReport } from '@agent-platform/contracts';

export const runtime = 'nodejs';
const MAX_REPORT_BYTES = 5 * 1024 * 1024;

function error(status: number, code: string): Response {
  return Response.json(
    { error: { code, message: 'Diagnostic history is unavailable in this connection.' } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Enabled only by an explicitly loopback-bound launcher. No renderer-held capability. */
export async function POST(request: Request): Promise<Response> {
  const local = localDiagnosticConnection(request);
  if (!local) return error(403, 'DIAGNOSTICS_DENIED');
  const { api, capability } = local;
  let text: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) return error(400, 'INVALID_SCOPE');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1024) {
        await reader.cancel();
        return error(400, 'INVALID_SCOPE');
      }
      chunks.push(chunk.value);
    }
    text = Buffer.concat(chunks).toString('utf8');
  } catch {
    return error(400, 'INVALID_SCOPE');
  }
  let scope;
  try {
    const body: unknown = JSON.parse(text);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).join() !== 'scope'
    )
      return error(400, 'INVALID_SCOPE');
    scope = DiagnosticScopeSchema.parse((body as { scope: unknown }).scope);
  } catch {
    return error(400, 'INVALID_SCOPE');
  }
  try {
    const response = await fetch(new URL('/v1/diagnostics/report', api), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json', 'x-diagnostics-capability': capability },
      body: JSON.stringify({ scope }),
      cache: 'no-store',
    });
    if (!response.ok) return error(response.status === 403 ? 403 : 503, 'DIAGNOSTICS_UNAVAILABLE');
    const reader = response.body?.getReader();
    if (!reader) return error(503, 'DIAGNOSTICS_UNAVAILABLE');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_REPORT_BYTES) {
        await reader.cancel();
        return error(503, 'REPORT_TOO_LARGE');
      }
      chunks.push(chunk.value);
    }
    const report = projectDiagnosticReport(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (JSON.stringify(report.scope) !== JSON.stringify(scope)) return error(503, 'SCOPE_MISMATCH');
    return Response.json(report, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="diagnostic-report.json"',
      },
    });
  } catch {
    return error(503, 'DIAGNOSTICS_UNAVAILABLE');
  }
}
