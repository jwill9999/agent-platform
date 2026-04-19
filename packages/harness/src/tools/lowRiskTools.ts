/**
 * Low-risk system tools — read-only I/O, PathJail enforced.
 *
 * These tools access the filesystem in read-only mode and rely on
 * PathJail (enforced in toolDispatch) for path validation.
 */

import { stat, access, readdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { constants } from 'node:fs';

import type { Output, Tool as ContractTool, RiskTier } from '@agent-platform/contracts';

const SYSTEM_TOOL_PREFIX = 'sys_';

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

export const LOW_RISK_IDS = {
  fileExists: `${SYSTEM_TOOL_PREFIX}file_exists`,
  fileInfo: `${SYSTEM_TOOL_PREFIX}file_info`,
  findFiles: `${SYSTEM_TOOL_PREFIX}find_files`,
} as const;

// ---------------------------------------------------------------------------
// Risk assignments
// ---------------------------------------------------------------------------

export const LOW_RISK_MAP: Record<string, RiskTier> = Object.fromEntries(
  Object.values(LOW_RISK_IDS).map((id) => [id, 'low' as RiskTier]),
);

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const LOW_RISK_TOOLS: readonly ContractTool[] = [
  {
    id: LOW_RISK_IDS.fileExists,
    slug: 'sys-file-exists',
    name: 'file_exists',
    description: 'Check if a file or directory exists at the given path.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to check.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    id: LOW_RISK_IDS.fileInfo,
    slug: 'sys-file-info',
    name: 'file_info',
    description: 'Get file metadata (size, type, permissions, timestamps) for a path.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to inspect.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    id: LOW_RISK_IDS.findFiles,
    slug: 'sys-find-files',
    name: 'find_files',
    description: 'Recursively search for files matching a pattern within a directory.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Root directory to search (default: workspace root / ".").',
          },
          pattern: {
            type: 'string',
            description: 'Substring or glob-like pattern to match filenames against.',
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum directory depth to recurse (default 5).',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum results to return (default 200).',
          },
        },
        required: ['pattern'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function str(args: Record<string, unknown>, key: string, fallback = ''): string {
  const v = args[key];
  return typeof v === 'string' ? v : fallback;
}

async function handleFileExists(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const filePath = str(args, 'path');
  if (!filePath.trim()) {
    return {
      type: 'error',
      code: 'INVALID_ARGS',
      message: 'path is required',
    };
  }
  try {
    await access(resolve(filePath), constants.F_OK);
    return {
      type: 'tool_result',
      toolId,
      data: { exists: true, path: resolve(filePath) },
    };
  } catch {
    return {
      type: 'tool_result',
      toolId,
      data: { exists: false, path: resolve(filePath) },
    };
  }
}

async function handleFileInfo(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const filePath = str(args, 'path');
  if (!filePath.trim()) {
    return {
      type: 'error',
      code: 'INVALID_ARGS',
      message: 'path is required',
    };
  }
  try {
    const s = await stat(resolve(filePath));
    return {
      type: 'tool_result',
      toolId,
      data: {
        path: resolve(filePath),
        type: s.isDirectory()
          ? 'directory'
          : s.isFile()
            ? 'file'
            : s.isSymbolicLink()
              ? 'symlink'
              : 'other',
        size: s.size,
        mode: `0${(s.mode & 0o777).toString(8)}`,
        createdAt: s.birthtime.toISOString(),
        modifiedAt: s.mtime.toISOString(),
        accessedAt: s.atime.toISOString(),
      },
    };
  } catch (err) {
    return {
      type: 'error',
      code: 'STAT_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_RESULTS = 200;
const HARD_MAX_RESULTS = 1000;

async function handleFindFiles(toolId: string, args: Record<string, unknown>): Promise<Output> {
  const directory = str(args, 'directory', '.');
  const pattern = str(args, 'pattern');
  if (!pattern.trim()) {
    return {
      type: 'error',
      code: 'INVALID_ARGS',
      message: 'pattern is required',
    };
  }
  const maxDepth =
    typeof args.maxDepth === 'number' ? Math.max(1, args.maxDepth) : DEFAULT_MAX_DEPTH;
  const maxResults = Math.min(
    typeof args.maxResults === 'number' ? Math.max(1, args.maxResults) : DEFAULT_MAX_RESULTS,
    HARD_MAX_RESULTS,
  );

  const rootDir = resolve(directory);
  const results: string[] = [];
  const patternLower = pattern.toLowerCase();

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || results.length >= maxResults) return;
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxResults) break;
      // Skip hidden files and common large directories
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      if (entry.toLowerCase().includes(patternLower)) {
        results.push(relative(rootDir, fullPath));
      }
      try {
        const s = await stat(fullPath);
        if (s.isDirectory()) {
          await walk(fullPath, depth + 1);
        }
      } catch {
        // skip unreadable entries
      }
    }
  }

  try {
    await walk(rootDir, 0);
    return {
      type: 'tool_result',
      toolId,
      data: {
        directory: rootDir,
        pattern,
        count: results.length,
        truncated: results.length >= maxResults,
        files: results,
      },
    };
  } catch (err) {
    return {
      type: 'error',
      code: 'FIND_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Executor — returns null if toolId is not a low-risk tool
// ---------------------------------------------------------------------------

export async function executeLowRiskTool(
  toolId: string,
  args: Record<string, unknown>,
): Promise<Output | null> {
  switch (toolId) {
    case LOW_RISK_IDS.fileExists:
      return handleFileExists(toolId, args);
    case LOW_RISK_IDS.fileInfo:
      return handleFileInfo(toolId, args);
    case LOW_RISK_IDS.findFiles:
      return handleFindFiles(toolId, args);
    default:
      return null;
  }
}
