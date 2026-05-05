export const TOOL_LABELS: Record<string, string> = {
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

const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  /sk-(?:proj-|svcacct-)?[A-Za-z0-9_*.-]{20,}/g,
  /(ghp|gho|ghu|ghs|ghr)_\w{36,}/g,
  /Bearer\s+[A-Za-z0-9_\-.~+/]{20,}/g,
];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function redactDisplayText(text: string): { text: string; redacted: boolean } {
  let redacted = false;
  const next = CREDENTIAL_PATTERNS.reduce((current, pattern) => {
    const replaced = current.replace(pattern, '[REDACTED:CREDENTIAL]');
    if (replaced !== current) redacted = true;
    return replaced;
  }, text);
  return { text: next, redacted };
}

export function toolActionLabel(toolId: string): string {
  if (TOOL_LABELS[toolId]) return TOOL_LABELS[toolId];
  if (toolId.startsWith('sys_browser_')) return 'Use browser tool';
  if (toolId.startsWith('sys_git_')) return 'Use git tool';
  if (toolId.startsWith('sys_')) return 'Run system tool';
  if (toolId.includes(':')) return 'Use connected tool';
  return 'Run tool action';
}
