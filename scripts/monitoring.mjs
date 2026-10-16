/** Safe command parsing and report projection; transport remains the private diagnostics reader. */
import {
  MonitoringPreferenceInputSchema,
  MonitoringPreferenceResultSchema,
  MonitoringStatusSchema,
  MonitoringWindowInputSchema,
  projectMonitoringReport,
} from '../packages/contracts/dist/index.js';

export const monitoringCommands = new Set(['monitoring-status', 'monitoring-set', 'window']);

function invalidArguments() {
  throw new Error('invalid_arguments');
}

function parseFlags(args) {
  const flags = new Map();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (!key?.startsWith('--') || flags.has(key)) invalidArguments();
    if (key === '--json') flags.set(key, true);
    else {
      const value = args[++index];
      if (!value || value.startsWith('--')) invalidArguments();
      flags.set(key, value);
    }
  }
  return flags;
}

function utcMilliseconds(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  )
    invalidArguments();
  const milliseconds = Date.parse(value);
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== canonical)
    invalidArguments();
  return milliseconds;
}

function integer(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) invalidArguments();
  const result = Number(value);
  if (!Number.isSafeInteger(result)) invalidArguments();
  return result;
}

const allowedCommandFlags = {
  'monitoring-status': ['--json'],
  'monitoring-set': ['--enabled', '--retention-days', '--json'],
  window: [
    '--from',
    '--to',
    '--session',
    '--monitoring-cursor',
    '--diagnostic-cursor',
    '--limit',
    '--json',
  ],
};

function parsePreference(flags) {
  const enabled = flags.get('--enabled');
  if (enabled !== 'true' && enabled !== 'false') invalidArguments();
  const parsed = MonitoringPreferenceInputSchema.safeParse({
    samplingEnabled: enabled === 'true',
    retentionDays: integer(flags.get('--retention-days')),
  });
  if (!parsed.success) invalidArguments();
  return parsed.data;
}

function parseWindow(flags) {
  const parsed = MonitoringWindowInputSchema.safeParse({
    window: {
      fromMs: utcMilliseconds(flags.get('--from')),
      toMs: utcMilliseconds(flags.get('--to')),
    },
    ...(flags.has('--session') ? { sessionId: flags.get('--session') } : {}),
    ...(flags.has('--monitoring-cursor')
      ? { monitoringCursor: flags.get('--monitoring-cursor') }
      : {}),
    ...(flags.has('--diagnostic-cursor')
      ? { diagnosticCursor: flags.get('--diagnostic-cursor') }
      : {}),
    ...(flags.has('--limit') ? { limit: integer(flags.get('--limit')) } : {}),
  });
  if (!parsed.success) invalidArguments();
  return parsed.data;
}

function commandRequest(command, flags) {
  if (command === 'monitoring-status') return { path: 'monitoring/status', body: {} };
  if (command === 'monitoring-set')
    return { path: 'monitoring/preference', body: parsePreference(flags) };
  return { path: 'monitoring/window', body: parseWindow(flags) };
}

export function parseMonitoringArguments(args) {
  const [command, ...rest] = args;
  if (!monitoringCommands.has(command)) invalidArguments();
  const flags = parseFlags(rest);
  if ([...flags.keys()].some((key) => !allowedCommandFlags[command].includes(key)))
    invalidArguments();
  const { path, body } = commandRequest(command, flags);
  return { command: path, monitoring: command, json: flags.has('--json'), body };
}

function recordingLabel(preference) {
  if (!preference) return 'unknown';
  return preference.samplingEnabled ? 'enabled' : 'disabled';
}

function renderPreference(input, options) {
  const result = MonitoringPreferenceResultSchema.parse(input);
  if (
    result.preference.samplingEnabled !== options.body.samplingEnabled ||
    result.preference.retentionDays !== options.body.retentionDays ||
    result.health.preference?.samplingEnabled !== result.preference.samplingEnabled ||
    result.health.preference?.retentionDays !== result.preference.retentionDays ||
    result.health.preference?.version !== result.preference.version
  )
    throw new Error('preference_mismatch');
  if (options.json) return JSON.stringify(result, null, 2);
  return `Resource recording preference saved: ${recordingLabel(result.preference)}, retention ${result.preference.retentionDays} days. Existing request and tool diagnostics are unchanged.`;
}

function renderStatus(input, json) {
  const status = MonitoringStatusSchema.parse(input);
  if (json) return JSON.stringify(status, null, 2);
  const preference = status.monitoring.preference;
  const retention = preference ? `${preference.retentionDays} days` : 'unavailable';
  return [
    `Local resource recording: ${recordingLabel(preference)}; store ${status.monitoring.state}.`,
    `Retention preference: ${retention}; actual retained coverage is bounded by age, count and storage.`,
    `Sample health: ${status.monitoring.reason}; dropped ${status.monitoring.dropped}; pending ${status.monitoring.pending}; pruned ${status.monitoring.pruned}; conflicts ${status.monitoring.conflicts}; previous shutdown unclean ${status.monitoring.previousShutdownUnclean}.`,
    `Last durable sample timestamp: ${status.monitoring.lastAcknowledgedAtMs ?? 'unavailable'}.`,
    `Existing request diagnostics: ${status.diagnostics.state}/${status.diagnostics.reason}; dropped ${status.diagnostics.dropped}; pending ${status.diagnostics.pending}; pruned ${status.diagnostics.pruned}; conflicts ${status.diagnostics.conflicts}; previous shutdown unclean ${status.diagnostics.previousShutdownUnclean}.`,
  ].join('\n');
}

export function renderMonitoringResponse(input, options) {
  if (options.monitoring === 'window') {
    // The shared projector reconstructs text from safe fields and binds the requested scope.
    const report = projectMonitoringReport(input, options.body);
    return options.json ? JSON.stringify(report, null, 2) : report.summary;
  }
  if (options.monitoring === 'monitoring-set') return renderPreference(input, options);
  return renderStatus(input, options.json);
}
