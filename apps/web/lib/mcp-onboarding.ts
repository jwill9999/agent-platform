import {
  McpServerCreateBodySchema,
  type McpServer,
  type McpServerCreateBody,
} from '@agent-platform/contracts';
import { ApiRequestError } from './apiClient';

const writeGuidance: Readonly<Record<string, string>> = {
  MCP_CONFIGURATION_INVALID:
    'Review the executable or endpoint and credential names. When changing transport, clear values that no longer apply.',
  MCP_SECRET_KEY_UNAVAILABLE:
    'Credential storage is unavailable. Configure a valid SECRETS_MASTER_KEY on the API host, then retry. No configuration was saved.',
  MCP_SECRET_DECRYPTION_FAILED:
    'Stored credentials could not be opened. Restore the original API host secret key or explicitly replace the affected values.',
  CONSTRAINT_VIOLATION:
    'A server with that name may already exist. Choose a unique name and retry.',
  NOT_FOUND: 'This server no longer exists. Return to the server list and reload.',
};

export function mcpWriteError(error: unknown): string {
  const guidance =
    error instanceof ApiRequestError && error.code && Object.hasOwn(writeGuidance, error.code)
      ? writeGuidance[error.code]
      : undefined;
  return guidance ?? 'The configuration was not saved. Check the API connection and try again.';
}

export interface CredentialRow {
  id: string;
  name: string;
  configured: boolean;
  existing: boolean;
  action: 'retain' | 'replace' | 'clear';
  value: string;
}

export function credentialRows(status: Record<string, boolean> = {}): CredentialRow[] {
  return Object.entries(status).map(([name, configured]) => ({
    id: name,
    name,
    configured,
    existing: true,
    action: 'retain',
    value: '',
  }));
}

/** An omitted key retains a value; an empty replacement never accidentally clears it. */
export function credentialChanges(
  rows: CredentialRow[],
  kind: 'env' | 'headers' = 'headers',
): Record<string, string | null> {
  const result: Record<string, string | null> = Object.create(null);
  const seen = new Set<string>();
  for (const row of rows) {
    const name = row.name.trim();
    const identity = kind === 'headers' ? name.toLowerCase() : name;
    if (!name || seen.has(identity)) {
      throw new Error('Credential names must be non-empty and unique.');
    }
    seen.add(identity);
    if (row.action === 'clear') result[name] = null;
    if (row.action === 'replace') {
      if (!row.value) throw new Error('Enter a replacement value or choose Clear.');
      result[name] = row.value;
    }
  }
  return result;
}

export function transportLabel(transport: string): string {
  if (transport === 'stdio') return 'Local process (stdio)';
  if (transport === 'streamable-http') return 'Streamable HTTP';
  if (transport === 'http') return 'Streamable HTTP (legacy http alias)';
  if (transport === 'sse') return 'Streamable HTTP (legacy sse alias; not SSE)';
  return 'Unsupported transport — reconfigure';
}

export interface McpTestResult {
  status: 'ok' | 'error';
  discoveredCount?: number;
  eligibleCount?: number;
  rejections?: { category: string; count: number }[];
  latencyMs: number;
  testedAt: string;
  configurationRevision: number;
  error?: string;
  code?: string;
  stage?: string;
  retryGuidance?: string;
}

export function currentTestResult(
  server: Pick<McpServer, 'configurationRevision'>,
  result: McpTestResult | undefined,
): McpTestResult | undefined {
  return result &&
    typeof server.configurationRevision === 'number' &&
    result.configurationRevision === server.configurationRevision
    ? result
    : undefined;
}

export function editorBody(input: {
  name: string;
  transport: string;
  command: string;
  argsText: string;
  url: string;
  env: CredentialRow[];
  headers: CredentialRow[];
}): McpServerCreateBody {
  const name = input.name.trim();
  if (!name) throw new Error('Name is required.');
  const transport =
    input.transport === 'http' || input.transport === 'sse' ? 'streamable-http' : input.transport;
  let args: unknown;
  try {
    args = JSON.parse(input.argsText || '[]');
  } catch {
    throw new Error('Arguments must be a JSON array of strings.');
  }
  if (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string')) {
    throw new Error('Arguments must be a JSON array of strings.');
  }
  const parsed = McpServerCreateBodySchema.safeParse({
    name,
    transport,
    ...(transport === 'stdio'
      ? { command: input.command.trim(), args }
      : { url: input.url.trim() }),
    credentials: {
      env: credentialChanges(input.env, 'env'),
      headers: credentialChanges(input.headers),
    },
  });
  if (!parsed.success)
    throw new Error(
      'Unsupported configuration. Check executable/arguments or HTTPS/local HTTP endpoint, remove URL credentials/query/fragment, and check environment/header names.',
    );
  return parsed.data;
}
