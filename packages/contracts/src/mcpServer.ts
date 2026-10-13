import { z } from 'zod';

const safeProperty = (name: string) =>
  !['__proto__', 'constructor', 'prototype'].includes(name.toLowerCase());
const noInterpolation = (value: string) => !value.includes('${') && !value.includes('\0');
export const McpEnvNameSchema = z
  .string()
  .max(128)
  .regex(/^[A-Za-z_]\w*$/)
  .refine(
    (name) =>
      safeProperty(name) &&
      !/^(NODE_OPTIONS|NODE_PATH|SECRETS_MASTER_KEY|LD_.*|DYLD_.*)$/i.test(name),
    'Reserved process environment variable',
  );
export const McpHeaderNameSchema = z
  .string()
  .max(128)
  .regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/)
  .refine(
    (name) =>
      safeProperty(name) &&
      !/^(host|cookie|set-cookie|content-.*|accept|connection|transfer-encoding|proxy-.*|mcp-.*|last-event-id|upgrade|te|trailer)$/i.test(
        name,
      ),
    'Transport-managed or unsafe header',
  );
export function validateMcpEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || !noInterpolation(value))
      return false;
    const host = url.hostname.toLowerCase();
    const local =
      host === 'localhost' ||
      host === 'host.docker.internal' ||
      host === '[::1]' ||
      /^127(?:\.\d{1,3}){3}$/.test(host);
    return url.protocol === 'https:' || (url.protocol === 'http:' && local);
  } catch {
    return false;
  }
}
const CredentialValueSchema = z
  .string()
  .max(16384)
  .refine(noInterpolation, 'Interpolation is unsupported');
export const McpCredentialChangesSchema = z
  .object({
    env: z.record(McpEnvNameSchema, CredentialValueSchema.nullable()).optional(),
    headers: z
      .record(
        McpHeaderNameSchema,
        CredentialValueSchema.refine(
          (value) =>
            [...value].every((character) => {
              const code = character.codePointAt(0)!;
              return code === 9 || (code >= 32 && code !== 127);
            }),
          'Invalid header value',
        ).nullable(),
      )
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const names = Object.keys(value.headers ?? {}).map((name) => name.toLowerCase());
    if (new Set(names).size !== names.length)
      ctx.addIssue({ code: 'custom', message: 'Header names must be unique ignoring case' });
    if (names.length > 100 || Object.keys(value.env ?? {}).length > 100)
      ctx.addIssue({ code: 'custom', message: 'Too many credential fields' });
  });
const ConnectionShape = {
  name: z.string().trim().min(1).max(200),
  transport: z
    .enum(['stdio', 'streamable-http', 'http', 'sse'])
    .transform((value) => (value === 'http' ? ('streamable-http' as const) : value)),
  command: z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .refine(noInterpolation, 'Interpolation is unsupported')
    .optional(),
  args: z
    .array(z.string().max(16384).refine(noInterpolation, 'Interpolation is unsupported'))
    .max(100)
    .optional(),
  url: z
    .string()
    .max(4096)
    .refine(
      validateMcpEndpoint,
      'Use HTTPS or local HTTP without URL credentials, query or fragment',
    )
    .optional(),
};
function validTransportFields(value: {
  transport: string;
  command?: string;
  args?: string[];
  url?: string;
}) {
  return value.transport === 'stdio'
    ? !!value.command && value.url === undefined
    : !!value.url && value.command === undefined && value.args === undefined;
}
export const McpConnectionConfigSchema = z
  .object(ConnectionShape)
  .strict()
  .refine(validTransportFields, 'Provide command/args for stdio, or URL for Streamable HTTP');
export const McpServerCreateBodySchema = z
  .object({ ...ConnectionShape, credentials: McpCredentialChangesSchema.optional() })
  .strict()
  .superRefine((value, ctx) => {
    if (!validTransportFields(value))
      ctx.addIssue({
        code: 'custom',
        message: 'Provide command/args for stdio, or URL for Streamable HTTP',
      });
    if (
      value.transport === 'stdio' &&
      Object.values(value.credentials?.headers ?? {}).some((entry) => entry !== null)
    )
      ctx.addIssue({ code: 'custom', message: 'Headers require Streamable HTTP' });
    if (
      value.transport !== 'stdio' &&
      Object.values(value.credentials?.env ?? {}).some((entry) => entry !== null)
    )
      ctx.addIssue({ code: 'custom', message: 'Environment variables require stdio' });
  });
export type McpServerCreateBody = z.infer<typeof McpServerCreateBodySchema>;
export const McpServerUpdateBodySchema = McpServerCreateBodySchema;
/** Public DTO: metadata retained only for source compatibility; DB reads never return it. */
export const McpServerSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  transport: z.string().min(1),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  credentialStatus: z
    .object({ env: z.record(z.boolean()), headers: z.record(z.boolean()) })
    .optional(),
  needsReconfiguration: z.boolean().optional(),
  configurationRevision: z.number().int().nonnegative().optional(),
});
export type McpServer = z.infer<typeof McpServerSchema>;
/** Secret-bearing connection material, never returned by public APIs or logs. */
export type ResolvedMcpConnection = McpServer & {
  env?: Record<string, string>;
  headers?: Record<string, string>;
};
export type McpImportEntry = { name: string; config?: McpServerCreateBody; error?: string };

function importEntry(name: string, value: unknown): McpImportEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { name, error: 'Expected a server configuration object' };
  const raw = value as Record<string, unknown>;
  const { env, headers, ...fields } = raw;
  if ('credentials' in raw && (env !== undefined || headers !== undefined))
    return { name, error: 'Use either top-level env/headers or credentials, not both' };
  const config = McpServerCreateBodySchema.safeParse({
    ...fields,
    name: raw['name'] ?? name,
    transport: raw['transport'] ?? (raw['url'] ? 'streamable-http' : 'stdio'),
    ...(env !== undefined || headers !== undefined ? { credentials: { env, headers } } : {}),
  });
  return config.success
    ? { name, config: config.data }
    : {
        name,
        error:
          'Unsupported or invalid configuration. Use an executable with argument array, or HTTPS/local HTTP URL; check credential names and remove unsupported fields.',
      };
}
/** Pure review parser: no execution or persistence; invalid entries are explicit. */
export function parseMcpImport(input: string): { entries: McpImportEntry[] } {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed))
    return { entries: [importEntry('MCP server', { url: trimmed })] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { entries: [{ name: 'Import', error: 'Invalid JSON or endpoint URL' }] };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return {
      entries: [{ name: 'Import', error: 'Expected a configuration object or named server map' }],
    };
  const raw = parsed as Record<string, unknown>;
  if ('command' in raw || 'url' in raw || 'transport' in raw)
    return { entries: [importEntry('MCP server', raw)] };
  const entries = 'mcpServers' in raw ? raw['mcpServers'] : raw;
  if (
    ('mcpServers' in raw && Object.keys(raw).length !== 1) ||
    !entries ||
    typeof entries !== 'object' ||
    Array.isArray(entries)
  )
    return { entries: [{ name: 'Import', error: 'Unsupported wrapper fields' }] };
  const result = Object.entries(entries).map(([name, value]) => importEntry(name, value));
  return {
    entries: result.length ? result : [{ name: 'Import', error: 'No server configurations found' }],
  };
}
