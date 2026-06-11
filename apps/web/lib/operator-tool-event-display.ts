import type { ToolTraceEvent } from '@/hooks/use-harness-chat';
import type { CapabilityRecovery } from '@agent-platform/contracts';
import {
  summarizeBrowserToolResult,
  type BrowserToolArtifactPreview,
} from '@/lib/browser-tool-results';
import {
  isRecord,
  redactDisplayText,
  stringValue,
  toolActionLabel,
} from '@/lib/operator-display-utils';

export type OperatorToolEventStatus =
  | 'running'
  | 'approval_required'
  | 'completed'
  | 'failed'
  | 'denied'
  | 'blocked'
  | 'unavailable'
  | 'capability_missing'
  | 'provider_required'
  | 'approval_escalation'
  | 'sandbox_available';

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
  recovery?: CapabilityRecovery;
  artifacts: BrowserToolArtifactPreview[];
};

const STATUS_LABELS: Record<OperatorToolEventStatus, string> = {
  running: 'Running',
  approval_required: 'Approval required',
  completed: 'Completed',
  failed: 'Failed',
  denied: 'Denied',
  blocked: 'Blocked',
  unavailable: 'Unavailable',
  capability_missing: 'Capability missing',
  provider_required: 'Provider required',
  approval_escalation: 'Approval escalation',
  sandbox_available: 'Sandbox available',
};

const RECOVERY_LABELS: Record<CapabilityRecovery['status'], string> = {
  capability_missing: 'Capability missing',
  provider_required: 'Provider required',
  approval_escalation: 'Approval needed',
  sandbox_available: 'Sandbox available',
};

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
  if (code === 'MACOS_VM_RUNNER_UNAVAILABLE') return 'Command runner unavailable';
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
    if (event.recovery) {
      return {
        label: RECOVERY_LABELS[event.recovery.status],
        status: event.recovery.status,
        statusLabel: STATUS_LABELS[event.recovery.status],
        summary: event.recovery.summary,
        recovery: event.recovery,
        details: stringifyDetails({
          code: event.code,
          message: event.message,
          recovery: event.recovery,
        }),
        artifacts: [],
      };
    }
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
  const label = toolActionLabel(event.toolId);
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
