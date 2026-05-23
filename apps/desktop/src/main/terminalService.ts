import { existsSync, realpathSync, statSync } from 'node:fs';
import { homedir as defaultHomedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';

import type { IpcValidationResult } from './ipcValidation.js';
import { fail, ok } from './ipcValidation.js';

export interface DesktopTerminalCreateRequest {
  readonly projectId?: string;
  readonly cols: number;
  readonly rows: number;
}

export interface DesktopTerminalInputRequest {
  readonly terminalId: string;
  readonly data: string;
}

export interface DesktopTerminalResizeRequest {
  readonly terminalId: string;
  readonly cols: number;
  readonly rows: number;
}

export interface DesktopTerminalDisposeRequest {
  readonly terminalId: string;
}

export interface DesktopTerminalCreateResult {
  readonly terminalId: string;
  readonly cwd: string;
  readonly shell: string;
  readonly pid: number;
}

export interface DesktopShellResolution {
  readonly shell: string;
  readonly args: readonly string[];
}

export interface DesktopPtySpawnOptions {
  readonly shell: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly cols: number;
  readonly rows: number;
}

export interface DesktopPtyProcess {
  readonly pid: number;
  readonly write: (data: string) => void;
  readonly resize: (cols: number, rows: number) => void;
  readonly kill: () => void;
  readonly onData: (callback: (data: string) => void) => void;
  readonly onExit: (callback: (event: { exitCode: number; signal?: number }) => void) => void;
}

export interface DesktopTerminalServiceOptions {
  readonly fetchProjectRoot: (projectId: string) => Promise<string | undefined>;
  readonly homedir?: () => string;
  readonly onData?: (event: { terminalId: string; data: string }) => void;
  readonly onExit?: (event: { terminalId: string; exitCode: number; signal?: number }) => void;
  readonly shellResolver: () => DesktopShellResolution;
  readonly spawnPty: (options: DesktopPtySpawnOptions) => DesktopPtyProcess;
}

export class DesktopTerminalService {
  private readonly fetchProjectRoot: (projectId: string) => Promise<string | undefined>;
  private readonly homedir: () => string;
  private readonly onData?: (event: { terminalId: string; data: string }) => void;
  private readonly onExit?: (event: {
    terminalId: string;
    exitCode: number;
    signal?: number;
  }) => void;
  private readonly shellResolver: () => DesktopShellResolution;
  private readonly spawnPty: (options: DesktopPtySpawnOptions) => DesktopPtyProcess;
  private readonly terminals = new Map<string, DesktopPtyProcess>();

  constructor(options: DesktopTerminalServiceOptions) {
    this.fetchProjectRoot = options.fetchProjectRoot;
    this.homedir = options.homedir ?? defaultHomedir;
    this.onData = options.onData;
    this.onExit = options.onExit;
    this.shellResolver = options.shellResolver;
    this.spawnPty = options.spawnPty;
  }

  async create(request: DesktopTerminalCreateRequest): Promise<DesktopTerminalCreateResult> {
    const cwd = await this.resolveInitialCwd(request.projectId);
    const shell = this.shellResolver();
    const term = this.spawnPty({
      shell: shell.shell,
      args: shell.args,
      cwd,
      cols: request.cols,
      rows: request.rows,
    });
    const terminalId = randomUUID();
    this.terminals.set(terminalId, term);
    term.onData((data) => {
      this.onData?.({ terminalId, data });
    });
    term.onExit(({ exitCode, signal }) => {
      this.terminals.delete(terminalId);
      this.onExit?.({
        terminalId,
        exitCode,
        ...(signal !== undefined ? { signal } : {}),
      });
    });

    return {
      terminalId,
      cwd,
      shell: shell.shell,
      pid: term.pid,
    };
  }

  write(request: DesktopTerminalInputRequest): void {
    this.requireTerminal(request.terminalId).write(request.data);
  }

  resize(request: DesktopTerminalResizeRequest): void {
    this.requireTerminal(request.terminalId).resize(request.cols, request.rows);
  }

  dispose(request: DesktopTerminalDisposeRequest): void {
    const term = this.terminals.get(request.terminalId);
    if (!term) return;
    term.kill();
    this.terminals.delete(request.terminalId);
  }

  disposeAll(): void {
    for (const terminalId of this.terminals.keys()) {
      this.dispose({ terminalId });
    }
  }

  private async resolveInitialCwd(projectId: string | undefined): Promise<string> {
    if (projectId) {
      const projectRoot = await this.fetchProjectRoot(projectId);
      const realProjectRoot = resolveExistingDirectory(projectRoot);
      if (realProjectRoot) return realProjectRoot;
    }

    return resolveExistingDirectory(this.homedir()) ?? this.homedir();
  }

  private requireTerminal(terminalId: string): DesktopPtyProcess {
    const term = this.terminals.get(terminalId);
    if (!term) {
      throw new Error('Terminal session not found.');
    }
    return term;
  }
}

export function resolveDesktopTerminalShell(
  env: NodeJS.ProcessEnv = process.env,
): DesktopShellResolution {
  if (process.platform === 'win32') {
    return { shell: env['COMSPEC'] ?? 'cmd.exe', args: [] };
  }

  const preferred = env['SHELL']?.trim();
  const candidates = [preferred, '/bin/zsh', '/bin/bash', '/bin/sh'].filter((p): p is string =>
    Boolean(p),
  );

  for (const shell of candidates) {
    try {
      if (!existsSync(shell) || !statSync(shell).isFile()) continue;
      const shellName = basename(shell);
      return {
        shell,
        args: shellName === 'zsh' || shellName === 'bash' ? ['-l'] : [],
      };
    } catch {
      continue;
    }
  }

  return { shell: '/bin/sh', args: [] };
}

export async function fetchDesktopProjectRootFromApi(
  apiBaseUrl: string,
  projectId: string,
): Promise<string | undefined> {
  const response = await fetch(
    `${trimTrailingSlashes(apiBaseUrl)}/v1/projects/${encodeURIComponent(projectId)}`,
    { cache: 'no-store' },
  );
  if (!response.ok) return undefined;
  const json = (await response.json()) as {
    data?: {
      metadata?: Record<string, unknown>;
    };
  };
  const root = json.data?.metadata?.['backendProjectRoot'];
  return typeof root === 'string' && root.trim() ? root : undefined;
}

export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
}

export function validateDesktopTerminalCreateRequest(
  payload: unknown,
): IpcValidationResult<DesktopTerminalCreateRequest> {
  const object = payloadObject(payload, 'Terminal create payload must be an object.');
  if (!object.ok || !object.value) return fail(object.error ?? 'Invalid terminal create payload.');
  const payloadRecord = object.value;
  const unsupported = unsupportedKeys(payloadRecord, ['projectId', 'cols', 'rows']);
  if (unsupported.length > 0) {
    return fail('Terminal create payload contains unsupported fields.');
  }

  const projectId = payloadRecord['projectId'];
  if (projectId !== undefined && (typeof projectId !== 'string' || !projectId.trim())) {
    return fail('Project id must be a non-empty string.');
  }

  const dimensions = readDimensions(payloadRecord);
  if (!dimensions.ok || !dimensions.value) {
    return fail(dimensions.error ?? 'Invalid terminal dimensions.');
  }
  const terminalDimensions = dimensions.value;

  return ok({
    ...(typeof projectId === 'string' ? { projectId } : {}),
    cols: terminalDimensions.cols,
    rows: terminalDimensions.rows,
  });
}

export function validateDesktopTerminalInputRequest(
  payload: unknown,
): IpcValidationResult<DesktopTerminalInputRequest> {
  const object = payloadObject(payload, 'Terminal input payload must be an object.');
  if (!object.ok || !object.value) return fail(object.error ?? 'Invalid terminal input payload.');
  const payloadRecord = object.value;
  const terminalId = readTerminalId(payloadRecord);
  if (!terminalId.ok || !terminalId.value) return fail(terminalId.error ?? 'Invalid terminal id.');
  const data = payloadRecord['data'];
  if (typeof data !== 'string') {
    return fail('Terminal input data is required.');
  }

  return ok({ terminalId: terminalId.value, data });
}

export function validateDesktopTerminalResizeRequest(
  payload: unknown,
): IpcValidationResult<DesktopTerminalResizeRequest> {
  const object = payloadObject(payload, 'Terminal resize payload must be an object.');
  if (!object.ok || !object.value) return fail(object.error ?? 'Invalid terminal resize payload.');
  const payloadRecord = object.value;
  const terminalId = readTerminalId(payloadRecord);
  if (!terminalId.ok || !terminalId.value) return fail(terminalId.error ?? 'Invalid terminal id.');
  const dimensions = readDimensions(payloadRecord);
  if (!dimensions.ok || !dimensions.value) {
    return fail(dimensions.error ?? 'Invalid terminal dimensions.');
  }
  const terminalDimensions = dimensions.value;

  return ok({
    terminalId: terminalId.value,
    cols: terminalDimensions.cols,
    rows: terminalDimensions.rows,
  });
}

export function validateDesktopTerminalDisposeRequest(
  payload: unknown,
): IpcValidationResult<DesktopTerminalDisposeRequest> {
  const object = payloadObject(payload, 'Terminal dispose payload must be an object.');
  if (!object.ok || !object.value) return fail(object.error ?? 'Invalid terminal dispose payload.');
  const terminalId = readTerminalId(object.value);
  if (!terminalId.ok || !terminalId.value) return fail(terminalId.error ?? 'Invalid terminal id.');
  return ok({ terminalId: terminalId.value });
}

function payloadObject(
  payload: unknown,
  error: string,
): IpcValidationResult<Record<string, unknown>> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return fail(error);
  }
  return ok(payload as Record<string, unknown>);
}

function readTerminalId(payload: Record<string, unknown>): IpcValidationResult<string> {
  const terminalId = payload['terminalId'];
  if (typeof terminalId !== 'string' || !terminalId.trim()) {
    return fail('Terminal id is required.');
  }
  return ok(terminalId);
}

function readDimensions(
  payload: Record<string, unknown>,
): IpcValidationResult<{ cols: number; rows: number }> {
  const cols = payload['cols'];
  const rows = payload['rows'];
  if (
    typeof cols !== 'number' ||
    typeof rows !== 'number' ||
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    cols <= 0 ||
    rows <= 0
  ) {
    return fail('Terminal dimensions must be positive integers.');
  }
  return ok({ cols, rows });
}

function unsupportedKeys(payload: Record<string, unknown>, supported: readonly string[]): string[] {
  const allowed = new Set(supported);
  return Object.keys(payload).filter((key) => !allowed.has(key));
}

function resolveExistingDirectory(path: string | undefined): string | undefined {
  if (!path) return undefined;
  try {
    if (!existsSync(path) || !statSync(path).isDirectory()) return undefined;
    return realpathSync(path);
  } catch {
    return undefined;
  }
}
