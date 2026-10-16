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
import { Readable } from 'node:stream';
import { assertRunActive, invokeRunAction, type RunExecutionControl } from '../runControl.js';

import type { Output, Tool as ContractTool } from '@agent-platform/contracts';
import { validateUrl } from '../security/urlGuard.js';
import { scanOutboundBody } from '../security/outputGuard.js';
import {
  SYSTEM_TOOL_PREFIX,
  MAX_OUTPUT_BYTES,
  stringArg,
  truncate,
  errorMessage,
  toolResult,
  toolError,
  buildRiskMap,
} from './toolHelpers.js';

type MediumRiskExecutionOptions = { signal?: AbortSignal; runControl?: RunExecutionControl };

const HTTP_TIMEOUT_MS = 30_000;
const MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_WRITE_SIZE = 10 * 1024 * 1024; // 10 MB

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

export const MEDIUM_RISK_MAP = buildRiskMap(MEDIUM_RISK_IDS, 'medium');

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
            type: 'string',
            description:
              'Optional HTTP headers as a JSON object string e.g. {"Content-Type":"application/json"}.',
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

async function handleAppendFile(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const filePath = stringArg(args, 'path');
  const content = stringArg(args, 'content');
  if (!filePath.trim()) {
    return toolError('INVALID_ARGS', 'path is required');
  }
  if (Buffer.byteLength(content, 'utf-8') > MAX_WRITE_SIZE) {
    return toolError('CONTENT_TOO_LARGE', `Content exceeds ${MAX_WRITE_SIZE} byte limit`);
  }
  try {
    await appendFile(resolve(filePath), content, 'utf-8');
    return toolResult(toolId, { appended: true, path: resolve(filePath) });
  } catch (err) {
    return toolError('APPEND_FAILED', errorMessage(err));
  }
}

async function handleCopyFile(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const source = stringArg(args, 'source');
  const destination = stringArg(args, 'destination');
  if (!source.trim() || !destination.trim()) {
    return toolError('INVALID_ARGS', 'source and destination are required');
  }
  try {
    await copyFile(resolve(source), resolve(destination));
    return toolResult(toolId, {
      copied: true,
      source: resolve(source),
      destination: resolve(destination),
    });
  } catch (err) {
    return toolError('COPY_FAILED', errorMessage(err));
  }
}

async function handleCreateDirectory(
  toolId: string,
  args: Record<string, unknown>,
): Promise<Output> {
  const dirPath = stringArg(args, 'path');
  if (!dirPath.trim()) {
    return toolError('INVALID_ARGS', 'path is required');
  }
  try {
    await mkdir(resolve(dirPath), { recursive: true });
    return toolResult(toolId, { created: true, path: resolve(dirPath) });
  } catch (err) {
    return toolError('MKDIR_FAILED', errorMessage(err));
  }
}

function requestHeaders(args: Record<string, unknown>): Record<string, string> {
  let headers: Record<string, string> = {};
  if (typeof args.headers === 'string' && args.headers.trim()) {
    try {
      const parsed: unknown = JSON.parse(args.headers);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        headers = parsed as Record<string, string>;
      }
    } catch {
      /* ignore malformed header JSON — proceed with empty headers */
    }
  } else if (typeof args.headers === 'object' && args.headers !== null) {
    headers = args.headers as Record<string, string>;
  }
  return headers;
}

async function handleHttpRequest(
  toolId: string,
  args: Record<string, unknown>,
  options?: MediumRiskExecutionOptions,
): Promise<Output> {
  const url = stringArg(args, 'url');
  if (!url.trim()) {
    return toolError('INVALID_ARGS', 'url is required');
  }

  const urlCheck = validateUrl(url);
  if (!urlCheck.allowed) {
    return toolError('URL_BLOCKED', urlCheck.reason ?? 'URL is blocked');
  }

  const method = stringArg(args, 'method', 'GET').toUpperCase();
  const headers = requestHeaders(args);
  const body = typeof args.body === 'string' ? args.body : undefined;
  const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : HTTP_TIMEOUT_MS;

  // Scan outbound body for sensitive data leakage
  if (body) {
    const bodyCheck = scanOutboundBody(url, body);
    if (!bodyCheck.safe) {
      return toolError(
        'OUTBOUND_DATA_BLOCKED',
        `Request body contains sensitive data: ${bodyCheck.issues.join(', ')}`,
      );
    }
  }

  return invokeRunAction(options?.runControl, options?.signal, 'tool', async () => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
      timeoutMs,
    );
    const signal = options?.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: ['POST', 'PUT', 'PATCH'].includes(method) ? body : undefined,
        signal,
      });
      const responseBody = truncate(await response.text(), MAX_OUTPUT_BYTES);
      return toolResult(toolId, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      });
    } catch {
      return toolError(
        'HTTP_OUTCOME_UNKNOWN',
        'The remote request may have completed. Check its effect before trying again.',
      );
    } finally {
      clearTimeout(timer);
    }
  });
}

async function handleDownloadFile(
  toolId: string,
  args: Record<string, unknown>,
  options?: MediumRiskExecutionOptions,
): Promise<Output> {
  const url = stringArg(args, 'url');
  const filePath = stringArg(args, 'path');
  if (!url.trim() || !filePath.trim()) {
    return toolError('INVALID_ARGS', 'url and path are required');
  }

  const urlCheck = validateUrl(url);
  if (!urlCheck.allowed) {
    return toolError('URL_BLOCKED', urlCheck.reason ?? 'URL is blocked');
  }

  const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : HTTP_TIMEOUT_MS;

  return invokeRunAction(options?.runControl, options?.signal, 'tool', async () => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new DOMException('Download timed out', 'TimeoutError')),
      timeoutMs,
    );
    const signal = options?.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;
    try {
      const response = await fetch(url, { signal });
      if (!response.ok)
        return toolError('DOWNLOAD_FAILED', `HTTP ${response.status}: ${response.statusText}`);
      if (!response.body) return toolError('DOWNLOAD_FAILED', 'No response body');
      const contentLength = response.headers.get('content-length');
      if (contentLength && Number.parseInt(contentLength, 10) > MAX_DOWNLOAD_SIZE)
        return toolError('DOWNLOAD_TOO_LARGE', `File exceeds ${MAX_DOWNLOAD_SIZE} byte limit`);
      assertRunActive(options?.runControl, signal);
      await mkdir(dirname(resolve(filePath)), { recursive: true });
      assertRunActive(options?.runControl, signal);
      const dest = createWriteStream(resolve(filePath));
      const readable = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
      await pipeline(readable, dest, { signal });
      return toolResult(toolId, { downloaded: true, path: resolve(filePath), url });
    } catch {
      return toolError(
        'DOWNLOAD_OUTCOME_UNKNOWN',
        'The download may have left a partial file. Check its outcome before trying again.',
      );
    } finally {
      clearTimeout(timer);
    }
  });
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

const HANDLERS: Record<
  string,
  (
    toolId: string,
    args: Record<string, unknown>,
    options?: MediumRiskExecutionOptions,
  ) => Promise<Output>
> = {
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
  options?: MediumRiskExecutionOptions,
): Promise<Output | null> {
  const handler = HANDLERS[toolId];
  if (!handler) return null;
  if (toolId === MEDIUM_RISK_IDS.httpRequest || toolId === MEDIUM_RISK_IDS.downloadFile)
    return handler(toolId, args, options);
  return invokeRunAction(options?.runControl, options?.signal, 'tool', () =>
    handler(toolId, args, options),
  );
}
