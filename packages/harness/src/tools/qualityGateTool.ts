import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants, existsSync } from 'node:fs';
import { access, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import {
  CodingRunQualityGateInputSchema,
  CodingRunQualityGateResultSchema,
  type CodingEvidence,
  type CodingQualityGateFailure,
  type CodingQualityGateProfile,
  type CodingToolEnvelope,
  type Output,
  type Tool as ContractTool,
} from '@agent-platform/contracts';
import { buildRiskMap, errorMessage, toolResult } from './toolHelpers.js';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;
const DEFAULT_OUTPUT_BYTES = 20_000;
const MAX_OUTPUT_BYTES = 100_000;
const MAX_EXEC_BUFFER_BYTES = 2 * 1024 * 1024;

export const QUALITY_GATE_TOOL_ID = 'sys_run_quality_gate';

export const QUALITY_GATE_IDS = {
  runQualityGate: QUALITY_GATE_TOOL_ID,
} as const;

export const QUALITY_GATE_MAP = buildRiskMap(QUALITY_GATE_IDS, 'medium');

export const QUALITY_GATE_TOOLS: readonly ContractTool[] = [
  {
    id: QUALITY_GATE_TOOL_ID,
    slug: 'sys-run-quality-gate',
    name: 'run_quality_gate',
    description:
      'Run an approved build/test quality gate profile with bounded output and structured evidence.',
    riskTier: 'medium',
    requiresApproval: false,
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          profile: {
            type: 'string',
            enum: ['test', 'typecheck', 'lint', 'format', 'docs', 'build', 'e2e'],
            description: 'Approved quality gate profile to run.',
          },
          repoPath: {
            type: 'string',
            description: 'Repository path, default ".".',
          },
          packageName: {
            type: 'string',
            description:
              'Optional package filter for package-supported profiles, e.g. @agent-platform/harness.',
          },
          timeoutMs: {
            type: 'number',
            description: `Timeout in milliseconds, capped at ${MAX_TIMEOUT_MS}.`,
          },
          maxOutputBytes: {
            type: 'number',
            description: `Maximum stdout/stderr tail bytes, capped at ${MAX_OUTPUT_BYTES}.`,
          },
        },
        required: ['profile'],
        additionalProperties: false,
      },
    },
  },
];

type QualityGateOptions = {
  workspaceRoot?: string;
  pnpmBin?: string;
};

type CommandSpec = {
  bin: string;
  args: string[];
  display: string[];
};

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
};

const PACKAGE_SUPPORTED_PROFILES = new Set<CodingQualityGateProfile>([
  'test',
  'typecheck',
  'lint',
  'build',
]);

const ROOT_SCRIPT_BY_PROFILE: Record<CodingQualityGateProfile, string> = {
  test: 'test',
  typecheck: 'typecheck',
  lint: 'lint',
  format: 'format:check',
  docs: 'docs:lint',
  build: 'build',
  e2e: 'test:e2e',
};

const PACKAGE_SCRIPT_BY_PROFILE: Partial<Record<CodingQualityGateProfile, string>> = {
  test: 'test',
  typecheck: 'typecheck',
  lint: 'lint',
  build: 'build',
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf-8');
}

function isWithin(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function resolvePnpmBin(override?: string): string {
  if (override) {
    if (!isAbsolute(override)) {
      throw new Error('pnpmBin override must be an absolute path');
    }
    return override;
  }

  const candidates = ['/opt/homebrew/bin/pnpm', '/usr/local/bin/pnpm', '/usr/bin/pnpm'];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('No fixed pnpm binary found; set an absolute pnpmBin option');
  }
  return found;
}

async function resolveRepoPath(
  inputRepoPath: string,
  options?: QualityGateOptions,
): Promise<string> {
  const workspaceRoot = await realpath(options?.workspaceRoot ?? process.cwd());
  const candidate = isAbsolute(inputRepoPath)
    ? inputRepoPath
    : resolve(workspaceRoot, inputRepoPath);

  try {
    await access(candidate, constants.R_OK);
  } catch {
    throw new Error(`Repository path "${candidate}" is not readable`);
  }

  const repoPath = await realpath(candidate);
  if (!isWithin(workspaceRoot, repoPath)) {
    throw new Error(`Repository path "${repoPath}" is outside the approved workspace`);
  }
  return repoPath;
}

function buildCommand(
  profile: CodingQualityGateProfile,
  packageName: string | undefined,
  pnpmBin: string,
): CommandSpec {
  if (packageName) {
    if (!PACKAGE_SUPPORTED_PROFILES.has(profile)) {
      throw new Error(`Profile "${profile}" does not support packageName`);
    }
    const script = PACKAGE_SCRIPT_BY_PROFILE[profile];
    if (!script) {
      throw new Error(`Profile "${profile}" does not have a package script mapping`);
    }
    const args = ['--filter', packageName, 'run', script];
    return { bin: pnpmBin, args, display: ['pnpm', ...args] };
  }

  const script = ROOT_SCRIPT_BY_PROFILE[profile];
  if (!script) {
    throw new Error(`Profile "${profile}" does not have a root script mapping`);
  }
  return { bin: pnpmBin, args: [script], display: ['pnpm', script] };
}

function tailUtf8(value: string, maxBytes: number): { content: string; truncated: boolean } {
  const bytes = Buffer.from(value, 'utf-8');
  if (bytes.byteLength <= maxBytes) return { content: value, truncated: false };
  return {
    content: `... (truncated, ${bytes.byteLength} bytes total)\n${bytes.subarray(bytes.byteLength - maxBytes).toString('utf-8')}`,
    truncated: true,
  };
}

function parseFailures(stdout: string, stderr: string): CodingQualityGateFailure[] {
  const combined = `${stdout}\n${stderr}`;
  const failures: CodingQualityGateFailure[] = [];
  const seen = new Set<string>();
  const patterns = [
    /^\s*(FAIL|Error|ERROR|×|✗|✖|ERR_[A-Z0-9_]+).*$/u,
    /^.*\b(TS\d{4}|AssertionError|TypeError|ReferenceError|SyntaxError|ESLint).*$/u,
  ];

  for (const line of combined.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (!patterns.some((pattern) => pattern.test(trimmed))) continue;
    seen.add(trimmed);
    const location = /([\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|md|json))(?::(\d+))?/.exec(trimmed);
    failures.push({
      message: trimmed.slice(0, 500),
      file: location?.[1],
      line: location?.[2] ? Number(location[2]) : undefined,
    });
    if (failures.length >= 20) break;
  }

  return failures;
}

function runCommand(spec: CommandSpec, cwd: string, timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolveResult) => {
    const proc = execFile(
      spec.bin,
      spec.args,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: MAX_EXEC_BUFFER_BYTES,
        env: { ...process.env, CI: process.env.CI ?? '1' },
      },
      (error, stdout, stderr) => {
        const timedOut =
          error instanceof Error &&
          'signal' in error &&
          (error as { signal?: unknown }).signal === 'SIGTERM';
        const exitCode =
          error && 'code' in error && typeof error.code === 'number'
            ? error.code
            : timedOut
              ? null
              : 0;
        resolveResult({ stdout, stderr, exitCode, timedOut });
      },
    );
    proc.on('error', () => {});
  });
}

function envelope(toolId: string, data: CodingToolEnvelope): Output {
  return toolResult(toolId, data as unknown as Record<string, unknown>);
}

function buildEvidence(
  status: CodingEvidence['status'],
  summary: string,
  startedAtMs: number,
  stdoutTail: string,
  stderrTail: string,
  failures: readonly CodingQualityGateFailure[],
  truncated: boolean,
): CodingEvidence {
  const completedAtMs = Date.now();
  return {
    kind: 'test',
    summary,
    artifacts: [
      {
        kind: 'stdout',
        label: 'stdout tail',
        storage: 'inline',
        mimeType: 'text/plain',
        content: stdoutTail,
        sizeBytes: byteLength(stdoutTail),
        truncated,
        sha256: sha256(stdoutTail),
      },
      {
        kind: 'stderr',
        label: 'stderr tail',
        storage: 'inline',
        mimeType: 'text/plain',
        content: stderrTail,
        sizeBytes: byteLength(stderrTail),
        truncated,
        sha256: sha256(stderrTail),
      },
      {
        kind: 'failure_summary',
        label: 'Failure summary',
        storage: 'inline',
        mimeType: 'application/json',
        content: JSON.stringify(failures, null, 2),
        sizeBytes: byteLength(JSON.stringify(failures)),
        truncated: false,
        sha256: sha256(JSON.stringify(failures)),
      },
    ],
    riskTier: 'medium',
    status,
    sourceTool: QUALITY_GATE_TOOL_ID,
    startedAtMs,
    completedAtMs,
    durationMs: completedAtMs - startedAtMs,
  };
}

function failure(toolId: string, message: string, startedAtMs: number): Output {
  return envelope(toolId, {
    ok: false,
    result: {},
    message,
    error: { code: 'QUALITY_GATE_DENIED', message },
    evidence: buildEvidence('denied', message, startedAtMs, '', '', [], false),
  });
}

async function handleRunQualityGate(
  toolId: string,
  args: Record<string, unknown>,
  options?: QualityGateOptions,
): Promise<Output> {
  const startedAtMs = Date.now();
  try {
    const input = CodingRunQualityGateInputSchema.parse(args);
    const repoPath = await resolveRepoPath(input.repoPath, options);
    const command = buildCommand(
      input.profile,
      input.packageName,
      resolvePnpmBin(options?.pnpmBin),
    );
    const timeoutMs = Math.min(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
    const maxOutputBytes = Math.min(input.maxOutputBytes ?? DEFAULT_OUTPUT_BYTES, MAX_OUTPUT_BYTES);
    const commandResult = await runCommand(command, repoPath, timeoutMs);
    const stdout = tailUtf8(commandResult.stdout, maxOutputBytes);
    const stderr = tailUtf8(commandResult.stderr, maxOutputBytes);
    const failures = parseFailures(commandResult.stdout, commandResult.stderr);
    const durationMs = Date.now() - startedAtMs;
    const ok = commandResult.exitCode === 0 && !commandResult.timedOut;
    const summary = ok
      ? `Quality gate "${input.profile}" passed.`
      : commandResult.timedOut
        ? `Quality gate "${input.profile}" timed out after ${timeoutMs}ms.`
        : `Quality gate "${input.profile}" failed with exit code ${commandResult.exitCode}.`;
    const result = CodingRunQualityGateResultSchema.parse({
      profile: input.profile,
      packageName: input.packageName,
      repoPath,
      command: command.display,
      exitCode: commandResult.exitCode,
      timedOut: commandResult.timedOut,
      durationMs,
      stdoutTail: stdout.content,
      stderrTail: stderr.content,
      truncated: stdout.truncated || stderr.truncated,
      failures,
    });

    return envelope(toolId, {
      ok,
      result,
      message: summary,
      error: ok
        ? undefined
        : {
            code: commandResult.timedOut ? 'QUALITY_GATE_TIMEOUT' : 'QUALITY_GATE_FAILED',
            message: summary,
          },
      evidence: buildEvidence(
        ok ? 'succeeded' : 'failed',
        summary,
        startedAtMs,
        result.stdoutTail,
        result.stderrTail,
        result.failures,
        result.truncated,
      ),
    });
  } catch (err) {
    return failure(toolId, errorMessage(err), startedAtMs);
  }
}

export async function executeQualityGateTool(
  toolId: string,
  args: Record<string, unknown>,
  options?: QualityGateOptions,
): Promise<Output | null> {
  if (toolId !== QUALITY_GATE_TOOL_ID) return null;
  return handleRunQualityGate(toolId, args, options);
}
