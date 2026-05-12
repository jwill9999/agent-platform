import type { BrowserWindow, OpenDialogOptions, OpenDialogReturnValue } from 'electron';
import { basename, isAbsolute, resolve } from 'node:path';

export interface DesktopSelectedProjectFolder {
  readonly path: string;
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
