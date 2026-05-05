import type { ToolTraceEvent } from '@/hooks/use-harness-chat';
import {
  summarizeBrowserToolResult,
  type BrowserToolArtifactPreview,
} from '@/lib/browser-tool-results';

export type OperatorToolEventStatus =
  | 'running'
  | 'approval_required'
  | 'completed'
  | 'failed'
  | 'denied'
  | 'blocked'
  | 'unavailable';

export type OperatorToolEventDisplay = {
  label: string;
  status: OperatorToolEventStatus;
  statusLabel: string;
  summary: string;
  target?: string;
  reason?: string;
  details?: {
    title: string;
    payload: string;
    redacted: boolean;
  };
  artifacts: BrowserToolArtifactPreview[];
};

const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  /sk-(?:proj-|svcacct-)?[A-Za-z0-9_*.-]{20,}/g,
  /(ghp|gho|ghu|ghs|ghr)_\w{36,}/g,
  /Bearer\s+[A-Za-z0-9_\-.~+/]{20,}/g,
];

const TOOL_LABELS: Record<string, string> = {
  sys_browser_start: 'Open browser page',
  sys_browser_screenshot: 'Capture screenshot',
  sys_browser_snapshot: 'Capture page snapshot',
  sys_browser_click: 'Click page element',
  sys_browser_type: 'Type into page',
  sys_browser_press: 'Press key on page',
  sys_git_status: 'Check branch status',
  sys_git_diff: 'Read code changes',
  sys_git_log: 'Read commit history',
  sys_query_recent_errors: 'Check recent errors',
  sys_query_sensor_findings: 'Check sensor findings',
  sys_query_sensor_providers: 'Check feedback providers',
  sys_query_current_trace: 'Check current trace',
  sys_bash: 'Run terminal command',
  sys_read_file: 'Read file',
  sys_write_file: 'Write file',
  sys_append_file: 'Update file',
  sys_list_files: 'List files',
};

const STATUS_LABELS: Record<OperatorToolEventStatus, string> = {
  running: 'Running',
  approval_required: 'Approval required',
  completed: 'Completed',
  failed: 'Failed',
  denied: 'Denied',
  blocked: 'Blocked',
  unavailable: 'Unavailable',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function redactDisplayText(text: string): { text: string; redacted: boolean } {
  let redacted = false;
  const next = CREDENTIAL_PATTERNS.reduce((current, pattern) => {
    const replaced = current.replace(pattern, '[REDACTED:CREDENTIAL]');
    if (replaced !== current) redacted = true;
    return replaced;
  }, text);
  return { text: next, redacted };
}

function stringifyDetails(payload: unknown): OperatorToolEventDisplay['details'] {
  let rendered: string;
  try {
    rendered =
      typeof payload === 'string' ? payload : (JSON.stringify(payload, null, 2) ?? String(payload));
  } catch {
    rendered = String(payload);
  }
  const redacted = redactDisplayText(rendered);
  return {
    title: 'Technical details',
    payload: redacted.text,
    redacted: redacted.redacted,
  };
}

function friendlyToolLabel(toolId: string): string {
  if (TOOL_LABELS[toolId]) return TOOL_LABELS[toolId];
  if (toolId.startsWith('sys_browser_')) return 'Use browser tool';
  if (toolId.startsWith('sys_git_')) return 'Use git tool';
  if (toolId.startsWith('sys_')) return 'Run system tool';
  if (toolId.includes(':')) return 'Use connected tool';
  return 'Run tool action';
}

function statusFromResult(
  event: Extract<ToolTraceEvent, { type: 'result' }>,
): OperatorToolEventStatus {
  const browserSummary = summarizeBrowserToolResult(event.data);
  if (browserSummary?.status === 'approval_required') return 'approval_required';
  if (browserSummary?.status === 'blocked') return 'blocked';
  if (event.status === 'success') return 'completed';
  if (event.status === 'error') return 'failed';
  return 'denied';
}

function policyReason(policy: string | undefined): string | undefined {
  if (!policy) return undefined;
  if (policy === 'external_domain_requires_approval') return 'External domain is not allowlisted';
  if (policy === 'risky_browser_action_requires_approval') {
    return 'Browser action requires approval';
  }
  if (policy === 'action_allowed') return 'Allowed by browser policy';
  if (policy === 'browser_url_approved') return 'Previously approved for this session';
  return undefined;
}

function resultTarget(data: unknown): string | undefined {
  const browserSummary = summarizeBrowserToolResult(data);
  if (browserSummary) return browserSummary.title ?? browserSummary.url;
  if (!isRecord(data)) return undefined;
  return (
    stringValue(data.path) ??
    stringValue(data.filePath) ??
    stringValue(data.branch) ??
    stringValue(data.url) ??
    stringValue(data.command)
  );
}

function resultReason(data: unknown): string | undefined {
  const browserSummary = summarizeBrowserToolResult(data);
  if (browserSummary) return browserSummary.error ?? policyReason(browserSummary.policy);
  if (!isRecord(data)) return undefined;
  const error = isRecord(data.error) ? data.error : undefined;
  return stringValue(error?.message) ?? stringValue(data.message) ?? stringValue(data.stderr);
}

function completedSummary(label: string): string {
  return `${label} completed`;
}

function resultSummary(
  label: string,
  status: OperatorToolEventStatus,
  reason: string | undefined,
): string {
  if (status === 'approval_required') return `Approval required to ${label.toLowerCase()}`;
  if (status === 'denied') return `${label} denied`;
  if (status === 'blocked') return `${label} blocked`;
  if (status === 'failed') return reason ? `${label} failed: ${reason}` : `${label} failed`;
  return completedSummary(label);
}

function errorLabel(code: string | undefined): string {
  if (code === 'PATH_ACCESS_DENIED') return 'Path access blocked';
  if (code === 'BASH_COMMAND_BLOCKED') return 'Terminal command blocked';
  if (code === 'QUALITY_GATE_DENIED') return 'Quality gate blocked completion';
  if (code === 'CONTENT_TOO_LARGE') return 'Content too large to display';
  if (code === 'INVALID_ARGS') return 'Tool input was invalid';
  if (code?.startsWith('MCP_')) return 'Connected tool failed';
  if (code?.startsWith('NATIVE_')) return 'System tool failed';
  if (code?.startsWith('TOOL_') || code?.endsWith('_FAILED')) return 'Tool action failed';
  return 'Tool error';
}

export function displayToolEvent(event: ToolTraceEvent): OperatorToolEventDisplay {
  if (event.type === 'status') {
    return {
      label: 'Running tool actions',
      status: 'running',
      statusLabel: STATUS_LABELS.running,
      summary: 'The agent is using tools',
      target: event.label.replace(/^Calling tools?:\s*/i, '').trim() || undefined,
      details: stringifyDetails({ label: event.label }),
      artifacts: [],
    };
  }

  if (event.type === 'error') {
    const redacted = redactDisplayText(event.message);
    return {
      label: errorLabel(event.code),
      status: event.code === 'CONTENT_TOO_LARGE' ? 'unavailable' : 'failed',
      statusLabel:
        event.code === 'CONTENT_TOO_LARGE' ? STATUS_LABELS.unavailable : STATUS_LABELS.failed,
      summary: redacted.text,
      details: stringifyDetails({ code: event.code, message: event.message }),
      artifacts: [],
    };
  }

  const browserSummary = summarizeBrowserToolResult(event.data);
  const label = friendlyToolLabel(event.toolId);
  const status = statusFromResult(event);
  const target = resultTarget(event.data);
  const reason = resultReason(event.data);

  return {
    label,
    status,
    statusLabel: STATUS_LABELS[status],
    summary: resultSummary(label, status, reason),
    target,
    reason,
    details: stringifyDetails({ toolId: event.toolId, data: event.data }),
    artifacts: browserSummary?.artifacts ?? [],
  };
}
