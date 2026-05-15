import type { BrowserWindow, OpenDialogOptions, OpenDialogReturnValue } from 'electron';
import { mkdir } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';

import type { IpcValidationResult } from './ipcValidation.js';
import { fail, ok } from './ipcValidation.js';

export interface DesktopSelectedProjectFolder {
  readonly path: string;
  readonly name: string;
}

export interface DesktopCreateProjectFolderRequest {
  readonly name: string;
}

export type DesktopProjectFolderSelectionResult =
  | { readonly canceled: true }
  | { readonly canceled: false; readonly folder: DesktopSelectedProjectFolder };

export interface DesktopProjectFolderDialog {
  readonly showOpenDialog: (
    window: BrowserWindow,
    options: OpenDialogOptions,
  ) => Promise<OpenDialogReturnValue>;
}

export const desktopProjectFolderOverrideEnv = 'AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIR';
export const desktopProjectFolderOverrideQueueEnv = 'AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS';
export const desktopProjectParentOverrideEnv = 'AGENT_PLATFORM_DESKTOP_TEST_PROJECT_PARENT_DIR';

export function normalizeDesktopProjectFolderSelection(
  result: Pick<OpenDialogReturnValue, 'canceled' | 'filePaths'>,
): DesktopProjectFolderSelectionResult {
  const firstPath = result.filePaths[0];
  if (result.canceled || firstPath === undefined) {
    return { canceled: true };
  }

  const selectedPath = resolve(firstPath);
  if (!isAbsolute(selectedPath)) {
    throw new Error('Native Project folder selection must return an absolute path.');
  }

  return {
    canceled: false,
    folder: {
      path: selectedPath,
      name: basename(selectedPath) || selectedPath,
    },
  };
}

export async function selectDesktopProjectFolder({
  dialog,
  env = process.env,
  window,
}: {
  dialog: DesktopProjectFolderDialog;
  env?: NodeJS.ProcessEnv;
  window: BrowserWindow;
}): Promise<DesktopProjectFolderSelectionResult> {
  const testProjectDir = consumeTestProjectFolderOverride(env);
  if (testProjectDir) {
    return normalizeDesktopProjectFolderSelection({
      canceled: false,
      filePaths: [testProjectDir],
    });
  }

  const result = await dialog.showOpenDialog(window, {
    buttonLabel: 'Open Project',
    message: 'Choose a Project folder',
    properties: ['openDirectory'],
    title: 'Open Project',
  });

  return normalizeDesktopProjectFolderSelection(result);
}

export async function createDesktopProjectFolder({
  dialog,
  env = process.env,
  request,
  window,
}: {
  dialog: DesktopProjectFolderDialog;
  env?: NodeJS.ProcessEnv;
  request: DesktopCreateProjectFolderRequest;
  window: BrowserWindow;
}): Promise<DesktopProjectFolderSelectionResult> {
  const projectName = validateDesktopProjectFolderName(request.name);
  const parentPath = await selectDesktopProjectParentFolder({ dialog, env, window });
  if (!parentPath) return { canceled: true };

  const projectPath = resolve(join(parentPath, projectName));
  const relativeProjectPath = relative(resolve(parentPath), projectPath);
  if (relativeProjectPath.startsWith('..') || isAbsolute(relativeProjectPath)) {
    throw new Error('Project folder must be created inside the selected parent folder.');
  }

  await mkdir(projectPath, { recursive: false });

  return {
    canceled: false,
    folder: {
      path: projectPath,
      name: projectName,
    },
  };
}

export function validateDesktopProjectFolderName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Enter a Project name.');
  }
  if (trimmed.length > 80) {
    throw new Error('Project name must be 80 characters or fewer.');
  }
  if (trimmed === '.' || trimmed === '..' || /[/\\]/.test(trimmed)) {
    throw new Error('Project name must be a folder name, not a path.');
  }
  if ([...trimmed].some((character) => character.charCodeAt(0) < 32)) {
    throw new Error('Project name contains unsupported characters.');
  }
  return trimmed;
}

export function validateDesktopCreateProjectFolderRequest(
  payload: unknown,
): IpcValidationResult<DesktopCreateProjectFolderRequest> {
  if (typeof payload !== 'object' || payload === null) {
    return fail('Project creation payload must be an object.');
  }

  const name = (payload as Record<string, unknown>)['name'];
  if (typeof name !== 'string') {
    return fail('Project name is required.');
  }

  try {
    return ok({ name: validateDesktopProjectFolderName(name) });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Invalid Project name.');
  }
}

function consumeTestProjectFolderOverride(env: NodeJS.ProcessEnv): string | undefined {
  const queued = env[desktopProjectFolderOverrideQueueEnv];
  if (queued) {
    const parsed = JSON.parse(queued) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`${desktopProjectFolderOverrideQueueEnv} must be a JSON string array.`);
    }
    const [next, ...remaining] = parsed;
    if (next !== undefined && typeof next !== 'string') {
      throw new Error(`${desktopProjectFolderOverrideQueueEnv} must contain only strings.`);
    }
    env[desktopProjectFolderOverrideQueueEnv] = JSON.stringify(remaining);
    if (next) return next;
  }

  return env[desktopProjectFolderOverrideEnv];
}

async function selectDesktopProjectParentFolder({
  dialog,
  env,
  window,
}: {
  dialog: DesktopProjectFolderDialog;
  env: NodeJS.ProcessEnv;
  window: BrowserWindow;
}): Promise<string | null> {
  const testParentDir = env[desktopProjectParentOverrideEnv];
  if (testParentDir) return resolve(testParentDir);

  const result = await dialog.showOpenDialog(window, {
    buttonLabel: 'Create Here',
    message: 'Choose where to create the Project folder',
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose Project Location',
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return resolve(result.filePaths[0]);
}
