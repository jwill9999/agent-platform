/**
 * Structured coding edit tool.
 *
 * Applies deterministic text operations after PathJail has resolved operation
 * paths in toolDispatch. Direct executor calls still operate on the provided
 * paths, so callers should prefer dispatch for policy enforcement.
 */

import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import {
  CodingApplyPatchInputSchema,
  type CodingApplyPatchResult,
  type CodingEvidence,
  type CodingToolEnvelope,
  type Output,
  type Tool as ContractTool,
} from '@agent-platform/contracts';
import { buildRiskMap, errorMessage, toolResult } from './toolHelpers.js';

export const CODING_APPLY_PATCH_ID = 'coding_apply_patch';

const MAX_OPERATIONS = 50;
const MAX_PATCH_BYTES = 512 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_INLINE_DIFF_BYTES = 80 * 1024;

export const CODING_EDIT_IDS = {
  applyPatch: CODING_APPLY_PATCH_ID,
} as const;

export const CODING_EDIT_MAP = buildRiskMap(CODING_EDIT_IDS, 'medium');

export const CODING_EDIT_TOOLS: readonly ContractTool[] = [
  {
    id: CODING_APPLY_PATCH_ID,
    slug: 'coding-apply-patch',
    name: 'coding_apply_patch',
    description:
      'Apply deterministic workspace-bounded text edits. Supports dry-run previews and returns a diff artifact.',
    riskTier: 'medium',
    requiresApproval: false,
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          operations: {
            type: 'array',
            minItems: 1,
            maxItems: MAX_OPERATIONS,
            items: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Workspace-relative file path to edit.',
                },
                oldText: {
                  type: 'string',
                  description:
                    'Exact text to replace. Omit to create the file or append to an existing file.',
                },
                newText: {
                  type: 'string',
                  description: 'Replacement, appended, or created text.',
                },
              },
              required: ['path', 'newText'],
              additionalProperties: false,
            },
          },
          reason: {
            type: 'string',
            description: 'Short reason for the edit.',
          },
          dryRun: {
            type: 'boolean',
            description: 'When true, preview the diff without writing files.',
            default: false,
          },
        },
        required: ['operations', 'reason'],
        additionalProperties: false,
      },
    },
  },
];

type ApplyOptions = {
  workspaceRoot?: string;
};

type PlannedFile = {
  path: string;
  displayPath: string;
  before: string;
  after: string;
  created: boolean;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf-8');
}

function hasNulBytes(value: string | Buffer): boolean {
  return typeof value === 'string' ? value.includes('\u0000') : value.includes(0);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function countOccurrences(content: string, needle: string): number {
  if (needle === '') return 0;
  let count = 0;
  let index = 0;
  while (index < content.length) {
    const found = content.indexOf(needle, index);
    if (found === -1) break;
    count++;
    index = found + needle.length;
  }
  return count;
}

function displayPathFor(filePath: string, workspaceRoot: string): string {
  const rel = relative(workspaceRoot, filePath);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : filePath;
}

function buildUnifiedDiff(plans: readonly PlannedFile[]): {
  content: string;
  sizeBytes: number;
  truncated: boolean;
  insertions: number;
  deletions: number;
} {
  let insertions = 0;
  let deletions = 0;
  const parts: string[] = [];

  for (const plan of plans) {
    const beforeLines = plan.before.split('\n');
    const afterLines = plan.after.split('\n');
    const beforeCount = plan.before ? beforeLines.length : 0;
    const afterCount = plan.after ? afterLines.length : 0;
    if (plan.before !== plan.after) {
      insertions += afterCount;
      deletions += beforeCount;
    }

    parts.push(`--- a/${plan.displayPath}`);
    parts.push(`+++ b/${plan.displayPath}`);
    parts.push(`@@ -1,${beforeCount} +1,${afterCount} @@`);
    if (plan.before) parts.push(...beforeLines.map((line) => `-${line}`));
    if (plan.after) parts.push(...afterLines.map((line) => `+${line}`));
  }

  const full = parts.join('\n');
  const sizeBytes = byteLength(full);
  if (sizeBytes <= MAX_INLINE_DIFF_BYTES) {
    return { content: full, sizeBytes, truncated: false, insertions, deletions };
  }

  const truncatedContent = `${full.slice(0, MAX_INLINE_DIFF_BYTES)}\n... (diff truncated, ${sizeBytes} bytes total)`;
  return { content: truncatedContent, sizeBytes, truncated: true, insertions, deletions };
}

function buildEvidence(
  status: CodingEvidence['status'],
  summary: string,
  startedAtMs: number,
  diff?: ReturnType<typeof buildUnifiedDiff>,
): CodingEvidence {
  const completedAtMs = Date.now();
  return {
    kind: 'edit',
    summary,
    artifacts: diff
      ? [
          {
            kind: 'diff',
            label: 'Patch diff',
            storage: 'inline',
            mimeType: 'text/x-diff',
            content: diff.content,
            sizeBytes: diff.sizeBytes,
            truncated: diff.truncated,
            sha256: sha256(diff.content),
          },
        ]
      : [],
    riskTier: 'medium',
    status,
    sourceTool: CODING_APPLY_PATCH_ID,
    startedAtMs,
    completedAtMs,
    durationMs: completedAtMs - startedAtMs,
  };
}

function envelope(toolId: string, data: CodingToolEnvelope): Output {
  return toolResult(toolId, data as unknown as Record<string, unknown>);
}

function failure(
  toolId: string,
  code: string,
  message: string,
  startedAtMs: number,
  status: CodingEvidence['status'] = 'failed',
): Output {
  return envelope(toolId, {
    ok: false,
    evidence: buildEvidence(status, message, startedAtMs),
    result: {},
    message,
    error: { code, message },
  });
}

async function readTextFile(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(`File exceeds ${MAX_FILE_BYTES} byte limit`);
  }
  if (hasNulBytes(buffer)) {
    throw new BinaryFileError(filePath);
  }
  return buffer.toString('utf-8');
}

async function initialPlan(filePath: string, workspaceRoot: string): Promise<PlannedFile> {
  const exists = await fileExists(filePath);
  const before = exists ? await readTextFile(filePath) : '';

  return {
    path: filePath,
    displayPath: displayPathFor(filePath, workspaceRoot),
    before,
    after: before,
    created: !exists,
  };
}

function applyOperation(
  plan: PlannedFile,
  operation: { path: string; oldText?: string; newText: string },
): PlannedFile {
  if (hasNulBytes(operation.newText) || hasNulBytes(operation.oldText ?? '')) {
    throw new BinaryFileError(plan.path);
  }

  let after: string;

  if (operation.oldText !== undefined) {
    const matches = countOccurrences(plan.after, operation.oldText);
    if (matches === 0) throw new PatchDoesNotApplyError(plan.path);
    if (matches > 1) throw new PatchConflictError(plan.path);
    after = plan.after.replace(operation.oldText, operation.newText);
  } else {
    after =
      plan.created && plan.after === '' ? operation.newText : `${plan.after}${operation.newText}`;
  }

  return {
    ...plan,
    after,
  };
}

function validateInputSize(operations: readonly { oldText?: string; newText: string }[]): boolean {
  const totalBytes = operations.reduce(
    (sum, operation) => sum + byteLength(operation.oldText ?? '') + byteLength(operation.newText),
    0,
  );
  return totalBytes <= MAX_PATCH_BYTES;
}

async function handleApplyPatch(
  toolId: string,
  args: Record<string, unknown>,
  options: ApplyOptions = {},
): Promise<Output> {
  const startedAtMs = Date.now();
  const parsed = CodingApplyPatchInputSchema.safeParse(args);
  if (!parsed.success) {
    return failure(
      toolId,
      'INVALID_ARGS',
      parsed.error.issues[0]?.message ?? 'Invalid input',
      startedAtMs,
    );
  }

  const input = parsed.data;
  if (input.operations.length > MAX_OPERATIONS) {
    return failure(
      toolId,
      'PATCH_TOO_LARGE',
      `Patch exceeds ${MAX_OPERATIONS} operations`,
      startedAtMs,
    );
  }
  if (!validateInputSize(input.operations)) {
    return failure(
      toolId,
      'PATCH_TOO_LARGE',
      `Patch exceeds ${MAX_PATCH_BYTES} byte limit`,
      startedAtMs,
    );
  }

  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());

  const byPath = new Map<string, PlannedFile>();
  try {
    for (const operation of input.operations) {
      const filePath = resolve(operation.path);
      const plan = byPath.get(filePath) ?? (await initialPlan(filePath, workspaceRoot));
      byPath.set(filePath, applyOperation(plan, operation));
    }
  } catch (err) {
    if (err instanceof BinaryFileError) {
      return failure(toolId, 'BINARY_FILE_DENIED', err.message, startedAtMs, 'denied');
    }
    if (err instanceof PatchDoesNotApplyError) {
      return failure(toolId, 'PATCH_DOES_NOT_APPLY', err.message, startedAtMs);
    }
    if (err instanceof PatchConflictError) {
      return failure(toolId, 'PATCH_CONFLICT', err.message, startedAtMs);
    }
    const message = errorMessage(err);
    const code = message.includes(`${MAX_FILE_BYTES}`) ? 'FILE_TOO_LARGE' : 'PATCH_FAILED';
    return failure(toolId, code, message, startedAtMs);
  }

  const plans = [...byPath.values()];

  const diff = buildUnifiedDiff(plans);
  const changedFiles = plans.map((plan) => plan.displayPath);
  const createdFiles = plans.filter((plan) => plan.created).map((plan) => plan.displayPath);
  const result: CodingApplyPatchResult = {
    dryRun: input.dryRun,
    changedFiles,
    createdFiles,
    deletedFiles: [],
    diffStat: {
      filesChanged: changedFiles.length,
      insertions: diff.insertions,
      deletions: diff.deletions,
    },
  };

  if (!input.dryRun) {
    try {
      for (const plan of plans) {
        await mkdir(dirname(plan.path), { recursive: true });
        await writeFile(plan.path, plan.after, 'utf-8');
      }
    } catch (err) {
      return failure(toolId, 'PATCH_WRITE_FAILED', errorMessage(err), startedAtMs);
    }
  }

  const summary = `${input.dryRun ? 'Dry run would change' : 'Changed'} ${changedFiles.length} file${changedFiles.length === 1 ? '' : 's'}.`;
  return envelope(toolId, {
    ok: true,
    evidence: buildEvidence('succeeded', summary, startedAtMs, diff),
    result: result as unknown as Record<string, unknown>,
  });
}

export async function executeCodingEditTool(
  toolId: string,
  args: Record<string, unknown>,
  options?: ApplyOptions,
): Promise<Output | null> {
  if (toolId !== CODING_APPLY_PATCH_ID) return null;
  return handleApplyPatch(toolId, args, options);
}

class BinaryFileError extends Error {
  constructor(filePath: string) {
    super(`Refusing to edit binary file: ${filePath}`);
    this.name = 'BinaryFileError';
  }
}

class PatchDoesNotApplyError extends Error {
  constructor(filePath: string) {
    super(`Patch does not apply cleanly to ${filePath}`);
    this.name = 'PatchDoesNotApplyError';
  }
}

class PatchConflictError extends Error {
  constructor(filePath: string) {
    super(`Patch text is not unique in ${filePath}`);
    this.name = 'PatchConflictError';
  }
}
