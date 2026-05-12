import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import type { DesktopRuntimePaths } from './runtimePaths.js';

export const desktopResetConfirmationText = 'DELETE LOCAL APP DATA';

export interface DesktopLocalDataResetRequest {
  readonly confirmation: string;
}

export interface DesktopLocalDataResetResult {
  readonly ok: true;
  readonly deletedPaths: string[];
  readonly missingPaths: string[];
  readonly preservedProjectFolders: true;
}

export function validateDesktopLocalDataResetRequest(
  payload: unknown,
): { ok: true; value: DesktopLocalDataResetRequest } | { ok: false; error: string } {
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, error: 'Expected reset request payload.' };
  }

  const confirmation = (payload as Partial<DesktopLocalDataResetRequest>).confirmation;
  if (typeof confirmation !== 'string') {
    return { ok: false, error: 'Expected reset confirmation text.' };
  }

  return { ok: true, value: { confirmation } };
}

export function resetDesktopLocalData({
  confirmation,
  paths,
}: {
  confirmation: string;
  paths: DesktopRuntimePaths;
}): DesktopLocalDataResetResult {
  if (confirmation !== desktopResetConfirmationText) {
    throw new Error(`Reset requires confirmation text: ${desktopResetConfirmationText}`);
  }

  const targets = getDesktopLocalDataDeletionTargets(paths);
  const deletedPaths: string[] = [];
  const missingPaths: string[] = [];

  for (const target of targets) {
    assertSafeDeletionTarget(target);
    if (!existsSync(target)) {
      missingPaths.push(target);
      continue;
    }

    rmSync(target, { recursive: true, force: true });
    deletedPaths.push(target);
  }

  mkdirSync(paths.configDir, { recursive: true });
  mkdirSync(paths.dataDir, { recursive: true });
  mkdirSync(paths.logDir, { recursive: true });
  mkdirSync(paths.tempDir, { recursive: true });

  return {
    ok: true,
    deletedPaths,
    missingPaths,
    preservedProjectFolders: true,
  };
}

export function getDesktopLocalDataDeletionTargets(paths: DesktopRuntimePaths): string[] {
  return Array.from(new Set([paths.configDir, paths.dataDir, paths.logDir, paths.tempDir])).map(
    (target) => resolve(target),
  );
}

function assertSafeDeletionTarget(target: string): void {
  const resolved = resolve(target);
  if (!isAbsolute(resolved) || resolved === '/' || resolved.length < 8) {
    throw new Error(`Refusing to delete unsafe desktop data path: ${target}`);
  }
}
