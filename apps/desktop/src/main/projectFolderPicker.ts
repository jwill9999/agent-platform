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
  window,
}: {
  dialog: DesktopProjectFolderDialog;
  window: BrowserWindow;
}): Promise<DesktopProjectFolderSelectionResult> {
  const result = await dialog.showOpenDialog(window, {
    buttonLabel: 'Open Project',
    message: 'Choose a Project folder',
    properties: ['openDirectory'],
    title: 'Open Project',
  });

  return normalizeDesktopProjectFolderSelection(result);
}
