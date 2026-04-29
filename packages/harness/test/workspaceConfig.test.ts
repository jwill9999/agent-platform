import { describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import {
  DEFAULT_WORKSPACE_CONTAINER_PATH,
  WORKSPACE_SUBDIRECTORIES,
  defaultPlatformHome,
  resolveWorkspaceConfig,
} from '../src/security/workspaceConfig.js';

describe('workspaceConfig', () => {
  it('resolves Linux defaults', () => {
    const config = resolveWorkspaceConfig({ platform: 'linux', env: {} });

    expect(config.platformHome).toBe(resolve(defaultPlatformHome('linux', {})));
    expect(config.workspaceHostPath).toBe(join(config.platformHome, 'workspaces', 'default'));
    expect(config.workspaceContainerPath).toBe(DEFAULT_WORKSPACE_CONTAINER_PATH);
    expect(config.dataHostPath).toBe(join(config.platformHome, 'data'));
  });

  it('resolves macOS defaults', () => {
    const config = resolveWorkspaceConfig({ platform: 'darwin', env: {} });

    expect(config.platformHome).toContain(join('Library', 'Application Support', 'AgentPlatform'));
  });

  it('resolves Windows defaults from LOCALAPPDATA', () => {
    const config = resolveWorkspaceConfig({
      platform: 'win32',
      env: { LOCALAPPDATA: 'C:\\Users\\Example\\AppData\\Local' },
    });

    expect(config.platformHome).toContain('AgentPlatform');
    expect(config.workspaceHostPath).toContain(join('AgentPlatform', 'workspaces', 'default'));
  });

  it('honors explicit overrides', () => {
    const config = resolveWorkspaceConfig({
      platform: 'linux',
      env: {
        AGENT_PLATFORM_HOME: '/tmp/platform-home',
        AGENT_WORKSPACE_HOST_PATH: '/tmp/custom-workspace',
        AGENT_WORKSPACE_CONTAINER_PATH: '/custom-workspace',
        AGENT_DATA_HOST_PATH: '/tmp/custom-data',
      },
    });

    expect(config.platformHome).toBe('/tmp/platform-home');
    expect(config.workspaceHostPath).toBe('/tmp/custom-workspace');
    expect(config.workspaceContainerPath).toBe('/custom-workspace');
    expect(config.dataHostPath).toBe('/tmp/custom-data');
  });

  it('includes every required first-run directory', () => {
    const config = resolveWorkspaceConfig({
      platform: 'linux',
      env: { AGENT_PLATFORM_HOME: '/tmp/platform-home' },
    });

    expect(config.directories).toEqual(
      WORKSPACE_SUBDIRECTORIES.map((dir) => join('/tmp/platform-home', dir)),
    );
  });
});
