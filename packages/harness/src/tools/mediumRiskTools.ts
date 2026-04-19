/**
 * Medium-risk system tools — write I/O, PathJail enforced + audit logged.
 *
 * These tools modify the filesystem or make network requests.
 * Path operations rely on PathJail (enforced in toolDispatch).
 * Network operations use the URL guard to block dangerous endpoints.
 */

import { appendFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

import type { Output, Tool as ContractTool, RiskTier } from '@agent-platform/contracts';
import { validateUrl } from '../security/urlGuard.js';

const SYSTEM_TOOL_PREFIX = 'sys_';
const MAX_OUTPUT_BYTES = 100_000;
const HTTP_TIMEOUT_MS = 30_000;
const MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024; // 50 MB

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

export const MEDIUM_RISK_IDS = {
  appendFile: `${SYSTEM_TOOL_PREFIX}append_file`,
  copyFile: `${SYSTEM_TOOL_PREFIX}copy_file`,
  createDirectory: `${SYSTEM_TOOL_PREFIX}create_directory`,
  httpRequest: `${SYSTEM_TOOL_PREFIX}http_request`,
  downloadFile: `${SYSTEM_TOOL_PREFIX}download_file`,
} as const;

// ---------------------------------------------------------------------------
// Risk assignments
// ---------------------------------------------------------------------------

export const MEDIUM_RISK_MAP: Record<string, RiskTier> = Object.fromEntries(
  Object.values(MEDIUM_RISK_IDS).map((id) => [id, 'medium' as RiskTier]),
);

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const MEDIUM_RISK_TOOLS: readonly ContractTool[] = [
  {
    id: MEDIUM_RISK_IDS.appendFile,
    slug: 'sys-append-file',
    name: 'append_file',
    description: 'Append content to an existing file.',
    riskTier: 'medium',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to append to.',
          },
          content: {
            type: 'string',
            description: 'Content to append.',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    id: MEDIUM_RISK_IDS.copyFile,
    slug: 'sys-copy-file',
    name: 'copy_file',
    description: 'Copy a file from source to destination within the workspace.',
    riskTier: 'medium',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Source file path.',
          },
          destination: {
            type: 'string',
            description: 'Destination file path.',
          },
        },
        required: ['source', 'destination'],
      },
    },
  },
  {
    id: MEDIUM_RISK_IDS.createDirectory,
    slug: 'sys-create-directory',
    name: 'create_directory',
    description: 'Create a directory (including parent directories) within the workspace.',
    riskTier: 'medium',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to create.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    id: MEDIUM_RISK_IDS.httpRequest,
    slug: 'sys-http-request',
    name: 'http_request',
    description:
      'Make an HTTP request to a URL. Returns status, headers, and body text. Blocked for internal/metadata endpoints.',
    riskTier: 'medium',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to request.',
          },
          method: {
            type: 'string',
            description: 'HTTP method (GET, POST, PUT, DELETE, PATCH). Default: GET.',
          },
          headers: {
            type: 'object',
            description: 'Optional HTTP headers as key-value pairs.',
          },
          body: {
            type: 'string',
            description: 'Optional request body (for POST/PUT/PATCH).',
          },
          timeout_ms: {
            type: 'number',
            description: `Timeout in milliseconds (default ${HTTP_TIMEOUT_MS}).`,
          },
        },
        required: ['url'],
      },
    },
  },
  {
    id: MEDIUM_RISK_IDS.downloadFile,
    slug: 'sys-download-file',
    name: 'download_file',
    description:
      'Download a file from a URL to a workspace path. Blocked for internal/metadata endpoints.',
    riskTier: 'medium',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to download from.',
          },
          path: {
            type: 'string',
            description: 'Destination file path in workspace.',
          },
          timeout_ms: {
            type: 'number',
            description: `Timeout in milliseconds (default ${HTTP_TIMEOUT_MS}).`,
          },
        },
        required: ['url', 'path'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stringArg(args: Record<string, unknown>, key: string, fallback = ''): string {
  const val = args[key];
  return typeof val === 'string' ? val : fallback;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… (truncated, ${text.length} total chars)`;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleAppendFile(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const filePath = stringArg(args, 'path');
  const content = stringArg(args, 'content');
  if (!filePath.trim()) {
    return { type: 'error', code: 'INVALID_ARGS', message: 'path is required' };
  }
  try {
    await appendFile(resolve(filePath), content, 'utf-8');
    return { type: 'tool_result', toolId, data: { appended: true, path: resolve(filePath) } };
  } catch (err) {
    return {
      type: 'error',
      code: 'APPEND_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleCopyFile(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const source = stringArg(args, 'source');
  const destination = stringArg(args, 'destination');
  if (!source.trim() || !destination.trim()) {
    return { type: 'error', code: 'INVALID_ARGS', message: 'source and destination are required' };
  }
  try {
    await copyFile(resolve(source), resolve(destination));
    return {
      type: 'tool_result',
      toolId,
      data: { copied: true, source: resolve(source), destination: resolve(destination) },
    };
  } catch (err) {
    return {
      type: 'error',
      code: 'COPY_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleCreateDirectory(
  toolId: string,
  args: Record<string, unknown>,
): Promise<Output> {
  const dirPath = stringArg(args, 'path');
  if (!dirPath.trim()) {
    return { type: 'error', code: 'INVALID_ARGS', message: 'path is required' };
  }
  try {
    await mkdir(resolve(dirPath), { recursive: true });
    return { type: 'tool_result', toolId, data: { created: true, path: resolve(dirPath) } };
  } catch (err) {
    return {
      type: 'error',
      code: 'MKDIR_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleHttpRequest(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const url = stringArg(args, 'url');
  if (!url.trim()) {
    return { type: 'error', code: 'INVALID_ARGS', message: 'url is required' };
  }

  const urlCheck = validateUrl(url);
  if (!urlCheck.allowed) {
    return { type: 'error', code: 'URL_BLOCKED', message: urlCheck.reason ?? 'URL is blocked' };
  }

  const method = stringArg(args, 'method', 'GET').toUpperCase();
  const headers =
    typeof args.headers === 'object' && args.headers !== null
      ? (args.headers as Record<string, string>)
      : {};
  const body = typeof args.body === 'string' ? args.body : undefined;
  const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : HTTP_TIMEOUT_MS;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method,
      headers,
      body: ['POST', 'PUT', 'PATCH'].includes(method) ? body : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    const responseBody = truncate(await response.text(), MAX_OUTPUT_BYTES);

    return {
      type: 'tool_result',
      toolId,
      data: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      },
    };
  } catch (err) {
    return {
      type: 'error',
      code: 'HTTP_REQUEST_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleDownloadFile(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const url = stringArg(args, 'url');
  const filePath = stringArg(args, 'path');
  if (!url.trim() || !filePath.trim()) {
    return { type: 'error', code: 'INVALID_ARGS', message: 'url and path are required' };
  }

  const urlCheck = validateUrl(url);
  if (!urlCheck.allowed) {
    return { type: 'error', code: 'URL_BLOCKED', message: urlCheck.reason ?? 'URL is blocked' };
  }

  const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : HTTP_TIMEOUT_MS;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        type: 'error',
        code: 'DOWNLOAD_FAILED',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    if (!response.body) {
      return {
        type: 'error',
        code: 'DOWNLOAD_FAILED',
        message: 'No response body',
      };
    }

    // Check content-length before downloading
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_SIZE) {
      return {
        type: 'error',
        code: 'DOWNLOAD_TOO_LARGE',
        message: `File exceeds ${MAX_DOWNLOAD_SIZE} byte limit`,
      };
    }

    // Ensure parent directory exists
    await mkdir(dirname(resolve(filePath)), { recursive: true });

    const dest = createWriteStream(resolve(filePath));
    // Node 18+ fetch body is a web ReadableStream; convert to Node stream
    const nodeStream = await import('node:stream');
    const readable = nodeStream.Readable.fromWeb(
      response.body as import('node:stream/web').ReadableStream,
    );
    await pipeline(readable, dest);

    return {
      type: 'tool_result',
      toolId,
      data: { downloaded: true, path: resolve(filePath), url },
    };
  } catch (err) {
    return {
      type: 'error',
      code: 'DOWNLOAD_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

const HANDLERS: Record<string, (toolId: string, args: Record<string, unknown>) => Promise<Output>> =
  {
    [MEDIUM_RISK_IDS.appendFile]: handleAppendFile,
    [MEDIUM_RISK_IDS.copyFile]: handleCopyFile,
    [MEDIUM_RISK_IDS.createDirectory]: handleCreateDirectory,
    [MEDIUM_RISK_IDS.httpRequest]: handleHttpRequest,
    [MEDIUM_RISK_IDS.downloadFile]: handleDownloadFile,
  };

/**
 * Execute a medium-risk tool. Returns null if toolId is not a medium-risk tool.
 */
export async function executeMediumRiskTool(
  toolId: string,
  args: Record<string, unknown>,
): Promise<Output | null> {
  const handler = HANDLERS[toolId];
  if (!handler) return null;
  return handler(toolId, args);
}
