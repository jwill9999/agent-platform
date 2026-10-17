import {
  MonitoringStatusSchema,
  MonitoringPreferenceInputSchema,
  MonitoringPreferenceResultSchema,
  MonitoringWindowInputSchema,
  projectMonitoringReport,
  type MonitoringWindowInput,
} from '@agent-platform/contracts';
import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { DesktopMonitoringExportResult } from '../preload/desktopBridge.js';
import {
  monitoringApi,
  monitoringPost,
  maximumMonitoringBytes,
  type MonitoringTransportDependencies,
} from './monitoringTransport.js';

export const monitoringSaveOverrideEnv = 'AGENT_PLATFORM_DESKTOP_TEST_SAVE_MONITORING_PATHS';
export type MonitoringExportDependencies = MonitoringTransportDependencies & {
  env?: NodeJS.ProcessEnv;
  showSaveDialog: (options: {
    defaultPath: string;
    title: string;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  writeFileImpl?: typeof writeFile;
};

function input<T>(payload: unknown, parse: (value: unknown) => T): T {
  try {
    return parse(payload);
  } catch {
    throw new Error('Monitoring input is invalid.');
  }
}
export function readMonitoringStatus(deps: MonitoringTransportDependencies) {
  return monitoringPost('status', {}, (value) => MonitoringStatusSchema.parse(value), deps);
}
export async function updateMonitoringPreference(
  payload: unknown,
  deps: MonitoringTransportDependencies,
) {
  const preference = input(payload, (value) => MonitoringPreferenceInputSchema.parse(value));
  const result = await monitoringPost(
    'preference',
    preference,
    (value) => MonitoringPreferenceResultSchema.parse(value),
    deps,
  );
  if (
    result.preference.samplingEnabled !== preference.samplingEnabled ||
    result.preference.retentionDays !== preference.retentionDays ||
    JSON.stringify(result.health.preference) !== JSON.stringify(result.preference)
  )
    throw new Error('Monitoring preference was not confirmed. Refresh its status.');
  return result;
}
async function destination(deps: MonitoringExportDependencies) {
  const env = deps.env ?? process.env;
  const override = env[monitoringSaveOverrideEnv];
  if (override !== undefined) {
    const queue: unknown = JSON.parse(override);
    if (!Array.isArray(queue) || (queue[0] !== null && typeof queue[0] !== 'string'))
      throw new Error('Invalid monitoring dialog fixture.');
    const [next, ...rest] = queue as (string | null)[];
    env[monitoringSaveOverrideEnv] = JSON.stringify(rest);
    return next ? { canceled: false, filePath: next } : { canceled: true };
  }
  return deps.showSaveDialog({
    defaultPath: 'monitoring-history.json',
    title: 'Save local monitoring history',
  });
}

export async function saveMonitoringReport(
  payload: unknown,
  deps: MonitoringExportDependencies,
): Promise<DesktopMonitoringExportResult> {
  const request = input(payload, (value) => MonitoringWindowInputSchema.parse(value));
  monitoringApi(deps);
  let selected: { canceled: boolean; filePath?: string };
  try {
    selected = await destination(deps);
  } catch {
    throw new Error('The monitoring history destination could not be selected.');
  }
  if (selected.canceled || !selected.filePath) return { ok: true, status: 'cancelled' };
  const report = await monitoringPost(
    'window',
    request,
    (value) => projectMonitoringReport(value, request),
    deps,
  );
  if (
    report.monitoring.window.fromMs !== request.window.fromMs ||
    report.monitoring.window.toMs !== request.window.toMs ||
    report.diagnostics.window.sessionId !== request.sessionId
  )
    throw new Error('Monitoring history did not match the requested window.');
  const data = JSON.stringify(report, null, 2) + '\n';
  if (Buffer.byteLength(data, 'utf8') > maximumMonitoringBytes)
    throw new Error('Monitoring history exceeds its safe size limit. Request a smaller page.');
  let continuation: MonitoringWindowInput | undefined;
  if (report.monitoring.nextCursor || report.diagnostics.nextCursor) {
    continuation = MonitoringWindowInputSchema.parse({
      ...request,
      monitoringCursor: report.monitoring.nextCursor ?? report.monitoring.completedCursor,
      diagnosticCursor: report.diagnostics.nextCursor ?? report.diagnostics.completedCursor,
    });
  }
  try {
    await (deps.writeFileImpl ?? writeFile)(selected.filePath, data, { flag: 'w', mode: 0o600 });
  } catch {
    throw new Error('The selected monitoring history file could not be written.');
  }
  return {
    ok: true,
    status: 'saved',
    filename: basename(selected.filePath),
    summary: `${report.monitoring.samples.length} resource samples and ${report.diagnostics.events.length} diagnostic events saved. ${report.coverage.incomplete ? 'Coverage is incomplete; review the report gaps and limits.' : 'Recorded page saved; missing activity cannot be inferred from absent events.'}`,
    incomplete: report.coverage.incomplete,
    ...(continuation ? { continuation } : {}),
  };
}
