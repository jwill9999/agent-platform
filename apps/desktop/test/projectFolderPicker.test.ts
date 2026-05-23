import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createDesktopProjectFolder,
  desktopProjectFolderOverrideEnv,
  desktopProjectFolderOverrideQueueEnv,
  desktopProjectParentOverrideEnv,
  normalizeDesktopProjectFolderSelection,
  selectDesktopProjectFolder,
  validateDesktopCreateProjectFolderRequest,
  validateDesktopProjectFolderName,
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

  it('validates new Project names before creating folders', () => {
    expect(validateDesktopProjectFolderName('  docs workspace  ')).toBe('docs workspace');
    expect(() => validateDesktopProjectFolderName('')).toThrow('Enter a Project name.');
    expect(() => validateDesktopProjectFolderName('../docs')).toThrow(
      'Project name must be a folder name, not a path.',
    );
    expect(validateDesktopCreateProjectFolderRequest({ name: 'fresh-project' })).toEqual({
      ok: true,
      value: { name: 'fresh-project' },
    });
    expect(validateDesktopCreateProjectFolderRequest({ name: '../fresh-project' })).toEqual({
      ok: false,
      error: 'Project name must be a folder name, not a path.',
    });
  });

  it('creates a new Project folder in a selected parent directory', async () => {
    const parentDir = mkdtempSync(join(tmpdir(), 'agent-platform-project-parent-'));
    const showOpenDialog = vi.fn();
    const dialog = { showOpenDialog } satisfies DesktopProjectFolderDialog;
    const window = {} as Parameters<typeof createDesktopProjectFolder>[0]['window'];

    try {
      await expect(
        createDesktopProjectFolder({
          dialog,
          env: { [desktopProjectParentOverrideEnv]: parentDir },
          request: { name: 'fresh-project' },
          window,
        }),
      ).resolves.toEqual({
        canceled: false,
        folder: {
          name: 'fresh-project',
          path: join(parentDir, 'fresh-project'),
        },
      });
      expect(existsSync(join(parentDir, 'fresh-project'))).toBe(true);
      expect(showOpenDialog).not.toHaveBeenCalled();
    } finally {
      rmSync(parentDir, { recursive: true, force: true });
    }
  });

  it('opens a native parent folder picker when creating a new Project', async () => {
    const parentDir = mkdtempSync(join(tmpdir(), 'agent-platform-project-parent-'));
    const showOpenDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: [parentDir],
    });
    const dialog = { showOpenDialog } satisfies DesktopProjectFolderDialog;
    const window = {} as Parameters<typeof createDesktopProjectFolder>[0]['window'];

    try {
      await createDesktopProjectFolder({
        dialog,
        request: { name: 'native-project' },
        window,
      });
      expect(showOpenDialog).toHaveBeenCalledWith(window, {
        buttonLabel: 'Create Here',
        message: 'Choose where to create the Project folder',
        properties: ['openDirectory', 'createDirectory'],
        title: 'Choose Project Location',
      });
    } finally {
      rmSync(parentDir, { recursive: true, force: true });
    }
  });

  it('does not create a folder when Project parent selection is canceled', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    const dialog = { showOpenDialog } satisfies DesktopProjectFolderDialog;
    const window = {} as Parameters<typeof createDesktopProjectFolder>[0]['window'];

    await expect(
      createDesktopProjectFolder({
        dialog,
        request: { name: 'cancelled-project' },
        window,
      }),
    ).resolves.toEqual({ canceled: true });
  });
});
