import { describe, expect, it } from 'vitest';

import { openProjectRootInIde } from '../src/main/ideLauncher.js';

describe('desktop IDE launcher', () => {
  it('reports unavailable Project folders without attempting a launch', async () => {
    const result = await openProjectRootInIde({
      env: {},
      platform: 'darwin',
      projectRoot: '   ',
      shell: {
        openPath: async () => {
          throw new Error('should not open a missing folder');
        },
      },
      launchAttempt: async () => {
        throw new Error('should not launch a missing folder');
      },
    });

    expect(result).toEqual({
      ok: true,
      handled: false,
      reason: 'Project folder is unavailable.',
    });
  });

  it('uses the explicit E2E launcher override without touching the host', async () => {
    const result = await openProjectRootInIde({
      env: { AGENT_PLATFORM_DESKTOP_TEST_OPEN_IDE: '1' },
      platform: 'darwin',
      projectRoot: '/Users/test/project',
      shell: {
        openPath: async () => {
          throw new Error('should not open the host fallback');
        },
      },
      launchAttempt: async () => {
        throw new Error('should not launch when the test override is enabled');
      },
    });

    expect(result).toEqual({
      ok: true,
      handled: true,
      projectRoot: '/Users/test/project',
      opener: 'test',
    });
  });

  it('prefers the configured IDE command before built-in candidates', async () => {
    const attempts: string[] = [];
    const result = await openProjectRootInIde({
      env: { AGENT_PLATFORM_DESKTOP_IDE_COMMAND: 'code-insiders' },
      platform: 'darwin',
      projectRoot: '/Users/test/project',
      shell: {
        openPath: async () => {
          throw new Error('should not use system fallback after configured command succeeds');
        },
      },
      launchAttempt: async (attempt) => {
        attempts.push(`${attempt.command} ${attempt.args.join(' ')}`);
        return attempt.command === 'code-insiders';
      },
    });

    expect(attempts).toEqual(['code-insiders /Users/test/project']);
    expect(result).toEqual({
      ok: true,
      handled: true,
      projectRoot: '/Users/test/project',
      opener: 'code-insiders',
    });
  });

  it('falls back to the system folder opener when IDE candidates are unavailable', async () => {
    const attempts: string[] = [];
    const result = await openProjectRootInIde({
      env: {},
      platform: 'darwin',
      projectRoot: '/Users/test/project',
      shell: {
        openPath: async (path) => {
          expect(path).toBe('/Users/test/project');
          return '';
        },
      },
      launchAttempt: async (attempt) => {
        attempts.push(attempt.opener);
        return false;
      },
    });

    expect(attempts).toContain('Visual Studio Code');
    expect(attempts).toContain('code');
    expect(result).toEqual({
      ok: true,
      handled: true,
      projectRoot: '/Users/test/project',
      opener: 'system',
    });
  });

  it('returns clear fallback copy when no local opener succeeds', async () => {
    const result = await openProjectRootInIde({
      env: {},
      platform: 'linux',
      projectRoot: '/workspace/project',
      shell: {
        openPath: async () => 'No application is registered',
      },
      launchAttempt: async () => false,
    });

    expect(result).toEqual({
      ok: true,
      handled: false,
      reason:
        'No local IDE or system folder opener succeeded. System fallback failed: No application is registered',
    });
  });
});
