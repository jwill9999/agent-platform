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
  MEDIUM_RISK_TOOLS,
  MEDIUM_RISK_MAP,
  executeMediumRiskTool,
} from './tools/index.js';
import {
  SYSTEM_TOOL_PREFIX,
  MAX_OUTPUT_BYTES,
  stringArg,
  truncate,
  errorMessage,
  toolResult,
  toolError,
} from './tools/toolHelpers.js';

// ---------------------------------------------------------------------------
// Tool definitions (contract-shaped, always injected into every agent)
// ---------------------------------------------------------------------------

/** Well-known IDs — no colons, no UUIDs; always allowed. */
const ids = {
  bash: `${SYSTEM_TOOL_PREFIX}bash`,
  readFile: `${SYSTEM_TOOL_PREFIX}read_file`,
  writeFile: `${SYSTEM_TOOL_PREFIX}write_file`,
  listFiles: `${SYSTEM_TOOL_PREFIX}list_files`,
  getSkillDetail: `${SYSTEM_TOOL_PREFIX}get_skill_detail`,
} as const;

/** Risk tier assignments for system tools. */
export const SYSTEM_TOOL_RISK: Record<string, RiskTier> = {
  [ids.bash]: 'high',
  [ids.readFile]: 'low',
  [ids.writeFile]: 'medium',
  [ids.listFiles]: 'low',
  [ids.getSkillDetail]: 'zero',
  ...ZERO_RISK_MAP,
  ...LOW_RISK_MAP,
  ...MEDIUM_RISK_MAP,
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
  // New medium-risk tools (write I/O + network, PathJail + URL guard enforced)
  ...MEDIUM_RISK_TOOLS,
  // Lazy skill loading — fetch full skill instructions on demand
  {
    id: ids.getSkillDetail,
    slug: 'sys-get-skill-detail',
    name: 'get_skill_detail',
    description:
      'Retrieve the full instructions for a skill before using it. Call this once per skill.',
    riskTier: SYSTEM_TOOL_RISK[ids.getSkillDetail],
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The ID of the skill to load (from the Available Skills list).',
          },
        },
        required: ['skill_id'],
      },
    },
  },
];

/** Set of system tool IDs for fast lookup. */
export const SYSTEM_TOOL_IDS = new Set(SYSTEM_TOOLS.map((t) => t.id));

/** ID for the lazy skill loading tool (used by toolDispatch interceptor). */
export const GET_SKILL_DETAIL_ID = ids.getSkillDetail;

/** Returns true if the given toolId is a built-in system tool. */
export function isSystemTool(toolId: string): boolean {
  return SYSTEM_TOOL_IDS.has(toolId);
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

const DEFAULT_BASH_TIMEOUT_MS = 30_000;
const MAX_BASH_TIMEOUT_MS = 120_000;

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

async function handleBash(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const command = stringArg(args, 'command');
  if (!command.trim()) {
    return toolError('INVALID_ARGS', 'command is required');
  }
  // Validate command against bash guardrails
  const validation = validateBashCommand(command);
  if (!validation.allowed) {
    return toolError('BASH_COMMAND_BLOCKED', validation.reason ?? 'Command is not allowed');
  }
  const rawTimeout =
    typeof args.timeout_ms === 'number' ? args.timeout_ms : DEFAULT_BASH_TIMEOUT_MS;
  const timeoutMs = Math.min(Math.max(rawTimeout, 1000), MAX_BASH_TIMEOUT_MS);
  const { stdout, stderr, exitCode } = await execBash(command, timeoutMs);
  return toolResult(toolId, { stdout, stderr, exitCode });
}

async function handleReadFile(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const filePath = stringArg(args, 'path');
  if (!filePath.trim()) {
    return toolError('INVALID_ARGS', 'path is required');
  }
  try {
    const content = await readFile(resolve(filePath), 'utf-8');
    return toolResult(toolId, { content: truncate(content, MAX_OUTPUT_BYTES) });
  } catch (err) {
    return toolError('READ_FAILED', errorMessage(err));
  }
}

const MAX_WRITE_SIZE = 10 * 1024 * 1024; // 10 MB

async function handleWriteFile(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const filePath = stringArg(args, 'path');
  const content = stringArg(args, 'content');
  if (!filePath.trim()) {
    return toolError('INVALID_ARGS', 'path is required');
  }
  if (Buffer.byteLength(content, 'utf-8') > MAX_WRITE_SIZE) {
    return toolError('CONTENT_TOO_LARGE', `Content exceeds ${MAX_WRITE_SIZE} byte limit`);
  }
  try {
    await writeFile(resolve(filePath), content, 'utf-8');
    return toolResult(toolId, { written: true, path: resolve(filePath) });
  } catch (err) {
    return toolError('WRITE_FAILED', errorMessage(err));
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
    return toolResult(toolId, { path: resolve(dirPath), entries: detailed });
  } catch (err) {
    return toolError('LIST_FAILED', errorMessage(err));
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

    // Medium-risk tools (async, write I/O + network)
    const mediumResult = await executeMediumRiskTool(toolId, args);
    if (mediumResult) return mediumResult;

    return {
      type: 'error',
      code: 'TOOL_NOT_FOUND',
      message: `Unknown system tool: ${toolId}`,
    };
  };
}
