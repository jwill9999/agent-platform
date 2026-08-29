import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { workspaceResourceUri } from '@agent-platform/contracts';
import { validateDesktopWorkspaceExportRequest } from '../src/main/workspaceResourceBridge.js';
import { saveWorkspaceResourceAs } from '../src/main/workspaceResourceExport.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fileUri(target = 'generated/report.md') {
  return workspaceResourceUri({ projectId: 'project-1', kind: 'file', target });
}

describe('workspace resource export', () => {
  it('validates only file resource identities and rejects renderer paths', () => {
    expect(validateDesktopWorkspaceExportRequest({ uri: fileUri() })).toMatchObject({
      ok: true,
      value: { uri: fileUri() },
    });
    expect(
      validateDesktopWorkspaceExportRequest({ uri: fileUri(), destinationPath: '/tmp/report.md' }),
    ).toMatchObject({ ok: false });
    expect(
      validateDesktopWorkspaceExportRequest({
        uri: workspaceResourceUri({
          projectId: 'project-1',
          kind: 'diff',
          target: 'src/index.ts',
        }),
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateDesktopWorkspaceExportRequest({
        uri: fileUri(),
        suggestedFilename: '../private.txt',
      }),
    ).toMatchObject({ ok: false });
  });

  it('treats native dialog cancellation as a no-op', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const writeFileImpl = vi.fn();

    await expect(
      saveWorkspaceResourceAs(
        { uri: fileUri(), suggestedFilename: 'report.md' },
        {
          apiBaseUrl: 'http://127.0.0.1:3000',
          fetchImpl,
          showSaveDialog: vi.fn().mockResolvedValue({ canceled: true }),
          writeFileImpl,
        },
      ),
    ).resolves.toEqual({ ok: true, status: 'cancelled' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(writeFileImpl).not.toHaveBeenCalled();
  });

  it('uses an explicit native-dialog E2E override queue', async () => {
    const showSaveDialog = vi.fn();
    const env = {
      AGENT_PLATFORM_DESKTOP_TEST_SAVE_RESOURCE_PATHS: JSON.stringify([null]),
    };

    await expect(
      saveWorkspaceResourceAs(
        { uri: fileUri() },
        {
          apiBaseUrl: 'http://127.0.0.1:3000',
          env,
          showSaveDialog,
        },
      ),
    ).resolves.toEqual({ ok: true, status: 'cancelled' });
    expect(showSaveDialog).not.toHaveBeenCalled();
    expect(env.AGENT_PLATFORM_DESKTOP_TEST_SAVE_RESOURCE_PATHS).toBe('[]');
  });

  it('fetches scoped bytes and writes only the native-dialog destination', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'agent-platform-export-'));
    temporaryDirectories.push(directory);
    const destination = join(directory, 'saved-report.md');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('# Saved report\n', {
        status: 200,
        headers: { 'content-type': 'text/markdown' },
      }),
    );

    await expect(
      saveWorkspaceResourceAs(
        { uri: fileUri(), suggestedFilename: 'report.md' },
        {
          apiBaseUrl: 'http://127.0.0.1:3000',
          fetchImpl,
          showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: destination }),
        },
      ),
    ).resolves.toEqual({ ok: true, status: 'saved', filename: 'saved-report.md' });

    expect(readFileSync(destination, 'utf8')).toBe('# Saved report\n');
    expect(fetchImpl).toHaveBeenCalledOnce();
    const requestUrl = String(fetchImpl.mock.calls[0]?.[0]);
    expect(requestUrl).toContain('/v1/projects/project-1/resources/export?');
    expect(requestUrl).toContain(encodeURIComponent(fileUri()));
    expect(requestUrl).not.toContain(destination);
  });

  it('redacts API and write failures', async () => {
    await expect(
      saveWorkspaceResourceAs(
        { uri: fileUri() },
        {
          apiBaseUrl: 'http://127.0.0.1:3000',
          fetchImpl: vi
            .fn<typeof fetch>()
            .mockResolvedValue(
              new Response('/Users/private/project was not found', { status: 404 }),
            ),
          showSaveDialog: vi
            .fn()
            .mockResolvedValue({ canceled: false, filePath: '/private/destination.md' }),
        },
      ),
    ).rejects.toThrow('The Project resource could not be prepared for saving.');
  });
});
