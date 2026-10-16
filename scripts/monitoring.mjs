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

export function parseMonitoringArguments(args) {
  const [command, ...rest] = args;
  if (!monitoringCommands.has(command)) invalidArguments();
  const flags = parseFlags(rest);
  const allowed =
    command === 'monitoring-status'
      ? ['--json']
      : command === 'monitoring-set'
        ? ['--enabled', '--retention-days', '--json']
        : [
            '--from',
            '--to',
            '--session',
            '--monitoring-cursor',
            '--diagnostic-cursor',
            '--limit',
            '--json',
          ];
  if ([...flags.keys()].some((key) => !allowed.includes(key))) invalidArguments();
  let body;
  let path;
  if (command === 'monitoring-status') {
    body = {};
    path = 'monitoring/status';
  } else if (command === 'monitoring-set') {
    const enabled = flags.get('--enabled');
    if (enabled !== 'true' && enabled !== 'false') invalidArguments();
    const parsed = MonitoringPreferenceInputSchema.safeParse({
      samplingEnabled: enabled === 'true',
      retentionDays: integer(flags.get('--retention-days')),
    });
    if (!parsed.success) invalidArguments();
    body = parsed.data;
    path = 'monitoring/preference';
  } else {
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
    body = parsed.data;
    path = 'monitoring/window';
  }
  return { command: path, monitoring: command, json: flags.has('--json'), body };
}

export function renderMonitoringResponse(input, options) {
  if (options.monitoring === 'window') {
    // The shared projector reconstructs text from safe fields and binds the requested scope.
    const report = projectMonitoringReport(input, options.body);
    return options.json ? JSON.stringify(report, null, 2) : report.summary;
  }
  if (options.monitoring === 'monitoring-set') {
    const result = MonitoringPreferenceResultSchema.parse(input);
    if (
      result.preference.samplingEnabled !== options.body.samplingEnabled ||
      result.preference.retentionDays !== options.body.retentionDays ||
      result.health.preference?.samplingEnabled !== result.preference.samplingEnabled ||
      result.health.preference?.retentionDays !== result.preference.retentionDays ||
      result.health.preference?.version !== result.preference.version
    )
      throw new Error('preference_mismatch');
    return options.json
      ? JSON.stringify(result, null, 2)
      : `Resource recording preference saved: ${result.preference.samplingEnabled ? 'enabled' : 'disabled'}, retention ${result.preference.retentionDays} days. Existing request and tool diagnostics are unchanged.`;
  }
  const status = MonitoringStatusSchema.parse(input);
  const preference = status.monitoring.preference;
  return options.json
    ? JSON.stringify(status, null, 2)
    : [
        `Local resource recording: ${preference ? (preference.samplingEnabled ? 'enabled' : 'disabled') : 'unknown'}; store ${status.monitoring.state}.`,
        `Retention preference: ${preference ? `${preference.retentionDays} days` : 'unavailable'}; actual retained coverage is bounded by age, count and storage.`,
        `Sample health: ${status.monitoring.reason}; dropped ${status.monitoring.dropped}; pending ${status.monitoring.pending}; pruned ${status.monitoring.pruned}; conflicts ${status.monitoring.conflicts}; previous shutdown unclean ${status.monitoring.previousShutdownUnclean}.`,
        `Last durable sample timestamp: ${status.monitoring.lastAcknowledgedAtMs ?? 'unavailable'}.`,
        `Existing request diagnostics: ${status.diagnostics.state}/${status.diagnostics.reason}; dropped ${status.diagnostics.dropped}; pending ${status.diagnostics.pending}; pruned ${status.diagnostics.pruned}; conflicts ${status.diagnostics.conflicts}; previous shutdown unclean ${status.diagnostics.previousShutdownUnclean}.`,
      ].join('\n');
}
