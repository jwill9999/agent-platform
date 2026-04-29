import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const DEFAULT_WORKSPACE_CONTAINER_PATH = '/workspace';
export const WORKSPACE_SUBDIRECTORIES = ['config', 'logs'];
export const WORKSPACE_CHILD_DIRECTORIES = ['uploads', 'generated', 'scratch', 'exports'];

function nonEmpty(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function defaultPlatformHome(platform = process.platform, env = process.env) {
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'AgentPlatform');
  }
  if (platform === 'win32') {
    const base =
      nonEmpty(env.LOCALAPPDATA) ??
      (nonEmpty(env.USERPROFILE) ? join(env.USERPROFILE, 'AppData', 'Local') : homedir());
    return join(base, 'AgentPlatform');
  }
  return join(homedir(), '.agent-platform');
}

export function resolveWorkspaceConfig(env = process.env) {
  const platformHome = resolve(nonEmpty(env.AGENT_PLATFORM_HOME) ?? defaultPlatformHome());
  const workspaceHostPath = resolve(
    nonEmpty(env.AGENT_WORKSPACE_HOST_PATH) ?? join(platformHome, 'workspaces', 'default'),
  );
  const dataHostPath = resolve(nonEmpty(env.AGENT_DATA_HOST_PATH) ?? join(platformHome, 'data'));
  const workspaceContainerPath =
    nonEmpty(env.AGENT_WORKSPACE_CONTAINER_PATH) ?? DEFAULT_WORKSPACE_CONTAINER_PATH;

  return {
    platformHome,
    workspaceHostPath,
    dataHostPath,
    workspaceContainerPath,
    directories: [
      ...WORKSPACE_SUBDIRECTORIES.map((dir) => join(platformHome, dir)),
      dataHostPath,
      workspaceHostPath,
      ...WORKSPACE_CHILD_DIRECTORIES.map((dir) => join(workspaceHostPath, dir)),
    ],
  };
}
