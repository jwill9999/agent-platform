import { execFile } from 'node:child_process';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Output, Tool as ContractTool, RiskTier } from '@agent-platform/contracts';
import type { NativeToolExecutor } from './types.js';
import { validateBashCommand } from './security/bashGuard.js';
import {
  ZERO_RISK_TOOLS,
  ZERO_RISK_MAP,
  executeZeroRiskTool,
  LOW_RISK_TOOLS,
  LOW_RISK_MAP,
  executeLowRiskTool,
} from './tools/index.js';

// ---------------------------------------------------------------------------
// Tool definitions (contract-shaped, always injected into every agent)
// ---------------------------------------------------------------------------

const SYSTEM_TOOL_PREFIX = 'sys_';

/** Well-known IDs — no colons, no UUIDs; always allowed. */
const ids = {
  bash: `${SYSTEM_TOOL_PREFIX}bash`,
  readFile: `${SYSTEM_TOOL_PREFIX}read_file`,
  writeFile: `${SYSTEM_TOOL_PREFIX}write_file`,
  listFiles: `${SYSTEM_TOOL_PREFIX}list_files`,
} as const;

/** Risk tier assignments for system tools. */
export const SYSTEM_TOOL_RISK: Record<string, RiskTier> = {
  [ids.bash]: 'high',
  [ids.readFile]: 'low',
  [ids.writeFile]: 'medium',
  [ids.listFiles]: 'low',
  ...ZERO_RISK_MAP,
  ...LOW_RISK_MAP,
} as const;

export const SYSTEM_TOOLS: readonly ContractTool[] = [
  {
    id: ids.bash,
    slug: 'sys-bash',
    name: 'bash',
    description: 'Execute a shell command and return its stdout/stderr.',
    riskTier: SYSTEM_TOOL_RISK[ids.bash],
    requiresApproval: true,
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute.',
          },
          timeout_ms: {
            type: 'number',
            description: 'Timeout in milliseconds (default 30000).',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    id: ids.readFile,
    slug: 'sys-read-file',
    name: 'read_file',
    description: 'Read the contents of a file at the given path.',
    riskTier: SYSTEM_TOOL_RISK[ids.readFile],
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative file path to read.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    id: ids.writeFile,
    slug: 'sys-write-file',
    name: 'write_file',
    description: 'Write content to a file, creating it if it does not exist.',
    riskTier: SYSTEM_TOOL_RISK[ids.writeFile],
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative file path to write.',
          },
          content: {
            type: 'string',
            description: 'The text content to write to the file.',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    id: ids.listFiles,
    slug: 'sys-list-files',
    name: 'list_files',
    description: 'List files and directories at the given path.',
    riskTier: SYSTEM_TOOL_RISK[ids.listFiles],
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to list (default ".").',
          },
        },
      },
    },
  },
  // New zero-risk tools (pure compute, no I/O)
  ...ZERO_RISK_TOOLS,
  // New low-risk tools (read-only I/O, PathJail enforced)
  ...LOW_RISK_TOOLS,
];

/** Set of system tool IDs for fast lookup. */
export const SYSTEM_TOOL_IDS = new Set(SYSTEM_TOOLS.map((t) => t.id));

/** Returns true if the given toolId is a built-in system tool. */
export function isSystemTool(toolId: string): boolean {
  return SYSTEM_TOOL_IDS.has(toolId);
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

const DEFAULT_BASH_TIMEOUT_MS = 30_000;
const MAX_BASH_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 100_000;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… (truncated, ${text.length} total chars)`;
}

async function execBash(
  command: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((res) => {
    const proc = execFile(
      '/bin/sh',
      ['-c', command],
      { timeout: timeoutMs, maxBuffer: MAX_OUTPUT_BYTES * 2 },
      (error, stdout, stderr) => {
        let exitCode = 0;
        if (error) {
          exitCode = 'code' in error && typeof error.code === 'number' ? error.code : 1;
        }
        res({
          stdout: truncate(stdout, MAX_OUTPUT_BYTES),
          stderr: truncate(stderr, MAX_OUTPUT_BYTES),
          exitCode,
        });
      },
    );
    // Ensure cleanup on timeout
    proc.on('error', () => {});
  });
}

/** Safely extract a string arg with a fallback. */
function stringArg(args: Record<string, unknown>, key: string, fallback = ''): string {
  const val = args[key];
  return typeof val === 'string' ? val : fallback;
}

async function handleBash(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const command = stringArg(args, 'command');
  if (!command.trim()) {
    return { type: 'error', code: 'INVALID_ARGS', message: 'command is required' };
  }
  // Validate command against bash guardrails
  const validation = validateBashCommand(command);
  if (!validation.allowed) {
    return {
      type: 'error',
      code: 'BASH_COMMAND_BLOCKED',
      message: validation.reason ?? 'Command is not allowed',
    };
  }
  const rawTimeout =
    typeof args.timeout_ms === 'number' ? args.timeout_ms : DEFAULT_BASH_TIMEOUT_MS;
  const timeoutMs = Math.min(Math.max(rawTimeout, 1000), MAX_BASH_TIMEOUT_MS);
  const { stdout, stderr, exitCode } = await execBash(command, timeoutMs);
  return { type: 'tool_result', toolId, data: { stdout, stderr, exitCode } };
}

async function handleReadFile(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const filePath = stringArg(args, 'path');
  if (!filePath.trim()) {
    return { type: 'error', code: 'INVALID_ARGS', message: 'path is required' };
  }
  try {
    const content = await readFile(resolve(filePath), 'utf-8');
    return {
      type: 'tool_result',
      toolId,
      data: { content: truncate(content, MAX_OUTPUT_BYTES) },
    };
  } catch (err) {
    return {
      type: 'error',
      code: 'READ_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleWriteFile(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const filePath = stringArg(args, 'path');
  const content = stringArg(args, 'content');
  if (!filePath.trim()) {
    return { type: 'error', code: 'INVALID_ARGS', message: 'path is required' };
  }
  try {
    await writeFile(resolve(filePath), content, 'utf-8');
    return { type: 'tool_result', toolId, data: { written: true, path: resolve(filePath) } };
  } catch (err) {
    return {
      type: 'error',
      code: 'WRITE_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleListFiles(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const dirPath = stringArg(args, 'path', '.');
  try {
    const entries = await readdir(resolve(dirPath));
    const detailed = await Promise.all(
      entries.map(async (name) => {
        try {
          const s = await stat(resolve(dirPath, name));
          return { name, type: s.isDirectory() ? 'directory' : 'file', size: s.size };
        } catch {
          return { name, type: 'unknown', size: 0 };
        }
      }),
    );
    return {
      type: 'tool_result',
      toolId,
      data: { path: resolve(dirPath), entries: detailed },
    };
  } catch (err) {
    return {
      type: 'error',
      code: 'LIST_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Creates the native executor that handles all system tools.
 * Returns an error `Output` for unknown tool IDs.
 */
export function createSystemToolExecutor(): NativeToolExecutor {
  return async (toolId: string, args: Record<string, unknown>): Promise<Output> => {
    // Core tools
    switch (toolId) {
      case ids.bash:
        return handleBash(toolId, args);
      case ids.readFile:
        return handleReadFile(toolId, args);
      case ids.writeFile:
        return handleWriteFile(toolId, args);
      case ids.listFiles:
        return handleListFiles(toolId, args);
    }

    // Zero-risk tools (synchronous, pure compute)
    const zeroResult = executeZeroRiskTool(toolId, args);
    if (zeroResult) return zeroResult;

    // Low-risk tools (async, read-only I/O)
    const lowResult = await executeLowRiskTool(toolId, args);
    if (lowResult) return lowResult;

    return {
      type: 'error',
      code: 'TOOL_NOT_FOUND',
      message: `Unknown system tool: ${toolId}`,
    };
  };
}
