import {
  DiagnosticScopeSchema,
  DiagnosticPartialFailureSchema,
  buildPartialDiagnosticReport,
  projectDiagnosticReport,
  type DiagnosticScope,
  type DiagnosticPartialFailure,
  type DesktopWorkspaceExportResult,
} from '@agent-platform/contracts';
import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fail, ok, type IpcValidationResult } from './ipcValidation.js';

const MAX_REPORT_BYTES = 5 * 1024 * 1024;
export const diagnosticSaveOverrideEnv = 'AGENT_PLATFORM_DESKTOP_TEST_SAVE_DIAGNOSTIC_PATHS';
export type DiagnosticExportDependencies = {
  apiBaseUrl: string;
  capability?: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  showSaveDialog: (options: {
    defaultPath: string;
    title: string;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  writeFileImpl?: typeof writeFile;
};
export function validateDiagnosticScope(payload: unknown): IpcValidationResult<DiagnosticScope> {
  const parsed = DiagnosticScopeSchema.safeParse(payload);
  return parsed.success ? ok(parsed.data) : fail('Diagnostic scope is invalid.');
}
export function validateDiagnosticPartial(
  payload: unknown,
): IpcValidationResult<DiagnosticPartialFailure> {
  const parsed = DiagnosticPartialFailureSchema.safeParse(payload);
  if (!parsed.success || Buffer.byteLength(JSON.stringify(payload), 'utf8') > 1024)
    return fail('Partial diagnostic input is invalid.');
  return ok(parsed.data);
}
async function destination(deps: DiagnosticExportDependencies) {
  const env = deps.env ?? process.env;
  const override = env[diagnosticSaveOverrideEnv];
  if (override !== undefined) {
    const queue: unknown = JSON.parse(override);
    if (!Array.isArray(queue) || (queue[0] !== null && typeof queue[0] !== 'string'))
      throw new Error('Invalid diagnostic dialog fixture.');
    const [next, ...rest] = queue as (string | null)[];
    env[diagnosticSaveOverrideEnv] = JSON.stringify(rest);
    return next ? { canceled: false, filePath: next } : { canceled: true };
  }
  return deps.showSaveDialog({
    defaultPath: 'diagnostic-report.json',
    title: 'Export diagnostic report',
  });
}
async function save(
  deps: DiagnosticExportDependencies,
  content: () => unknown | Promise<unknown>,
): Promise<DesktopWorkspaceExportResult> {
  const selected = await destination(deps);
  if (selected.canceled || !selected.filePath) return { ok: true, status: 'cancelled' };
  // Always reconstruct readable text from the shared allowlisted schema, including in main.
  let data: string;
  try {
    const report = projectDiagnosticReport(await content());
    data = JSON.stringify(report, null, 2) + '\n';
  } catch {
    // Parsing, schema and transport errors may contain backend payloads or secrets.
    throw new Error('Diagnostic report could not be prepared.');
  }
  if (Buffer.byteLength(data, 'utf8') > MAX_REPORT_BYTES)
    throw new Error('Diagnostic report exceeds its safe size limit.');
  try {
    await (deps.writeFileImpl ?? writeFile)(selected.filePath, data, { flag: 'w', mode: 0o600 });
  } catch {
    throw new Error('The selected diagnostic report file could not be written.');
  }
  return { ok: true, status: 'saved', filename: basename(selected.filePath) };
}
export async function saveDiagnosticReport(
  scope: DiagnosticScope,
  deps: DiagnosticExportDependencies,
): Promise<DesktopWorkspaceExportResult> {
  const validated = DiagnosticScopeSchema.parse(scope);
  const api = new URL(deps.apiBaseUrl);
  if (
    api.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(api.hostname) ||
    api.username ||
    api.password ||
    !/^[a-f0-9]{64}$/.test(deps.capability ?? '')
  )
    throw new Error('Diagnostic history is unavailable in this connection.');
  return save(deps, async () => {
    const response = await (deps.fetchImpl ?? fetch)(new URL('/v1/diagnostics/report', api), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json', 'x-diagnostics-capability': deps.capability! },
      body: JSON.stringify({ scope: validated }),
    });
    if (!response.ok) throw new Error('Diagnostic history could not be retrieved.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Diagnostic report was empty.');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    // Sequential reads enforce backpressure and stop/cancel before retaining oversized data.
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_REPORT_BYTES) {
        await reader.cancel();
        throw new Error('Diagnostic report exceeds its safe size limit.');
      }
      chunks.push(chunk.value);
    }
    const report = projectDiagnosticReport(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (JSON.stringify(report.scope) !== JSON.stringify(validated))
      throw new Error('Diagnostic report scope did not match.');
    return report;
  });
}
export async function savePartialDiagnosticReport(
  failure: DiagnosticPartialFailure,
  deps: DiagnosticExportDependencies,
): Promise<DesktopWorkspaceExportResult> {
  const validated = validateDiagnosticPartial(failure);
  if (!validated.ok || !validated.value) throw new Error('Partial diagnostic input is invalid.');
  return save(deps, () => buildPartialDiagnosticReport(validated.value!));
}
