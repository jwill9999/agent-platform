import { describe, expect, it, vi } from 'vitest';

import {
  desktopProjectFolderOverrideEnv,
  desktopProjectFolderOverrideQueueEnv,
  normalizeDesktopProjectFolderSelection,
  selectDesktopProjectFolder,
  type DesktopProjectFolderDialog,
} from '../src/main/projectFolderPicker.js';

describe('desktop Project folder picker', () => {
  it('normalizes a selected native folder into Project metadata', () => {
    expect(
      normalizeDesktopProjectFolderSelection({
        canceled: false,
        filePaths: ['/Users/example/projects/authentication-frontend'],
      }),
    ).toEqual({
      canceled: false,
      folder: {
        name: 'authentication-frontend',
        path: '/Users/example/projects/authentication-frontend',
      },
    });
  });

  it('treats cancellation as a non-error result', () => {
    expect(
      normalizeDesktopProjectFolderSelection({
        canceled: true,
        filePaths: [],
      }),
    ).toEqual({ canceled: true });
  });

  it('treats empty folder selections as cancellation', () => {
    expect(
      normalizeDesktopProjectFolderSelection({
        canceled: false,
        filePaths: [],
      }),
    ).toEqual({ canceled: true });
  });

  it('opens only a native folder picker from the main process', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['/Users/example/projects/docs'],
    });
    const dialog = { showOpenDialog } satisfies DesktopProjectFolderDialog;
    const window = {} as Parameters<typeof selectDesktopProjectFolder>[0]['window'];

    await expect(selectDesktopProjectFolder({ dialog, window })).resolves.toEqual({
      canceled: false,
      folder: {
        name: 'docs',
        path: '/Users/example/projects/docs',
      },
    });
    expect(showOpenDialog).toHaveBeenCalledWith(window, {
      buttonLabel: 'Open Project',
      message: 'Choose a Project folder',
      properties: ['openDirectory'],
      title: 'Open Project',
    });
  });

  it('uses an explicit E2E Project folder override without opening a native dialog', async () => {
    const showOpenDialog = vi.fn();
    const dialog = { showOpenDialog } satisfies DesktopProjectFolderDialog;
    const window = {} as Parameters<typeof selectDesktopProjectFolder>[0]['window'];

    await expect(
      selectDesktopProjectFolder({
        dialog,
        env: {
          [desktopProjectFolderOverrideEnv]: '/Users/example/projects/electron-e2e-project',
        },
        window,
      }),
    ).resolves.toEqual({
      canceled: false,
      folder: {
        name: 'electron-e2e-project',
        path: '/Users/example/projects/electron-e2e-project',
      },
    });
    expect(showOpenDialog).not.toHaveBeenCalled();
  });

  it('uses queued E2E Project folder overrides in order', async () => {
    const showOpenDialog = vi.fn();
    const dialog = { showOpenDialog } satisfies DesktopProjectFolderDialog;
    const window = {} as Parameters<typeof selectDesktopProjectFolder>[0]['window'];
    const env = {
      [desktopProjectFolderOverrideQueueEnv]: JSON.stringify([
        '/Users/example/projects/first-project',
        '/Users/example/projects/second-project',
      ]),
    };

    await expect(selectDesktopProjectFolder({ dialog, env, window })).resolves.toEqual({
      canceled: false,
      folder: {
        name: 'first-project',
        path: '/Users/example/projects/first-project',
      },
    });
    await expect(selectDesktopProjectFolder({ dialog, env, window })).resolves.toEqual({
      canceled: false,
      folder: {
        name: 'second-project',
        path: '/Users/example/projects/second-project',
      },
    });
    expect(showOpenDialog).not.toHaveBeenCalled();
  });
});
