import { homedir } from 'node:os';
import { resolve, join } from 'node:path';

export const DEFAULT_WORKSPACE_CONTAINER_PATH = '/workspace';

export const WORKSPACE_SUBDIRECTORIES = ['config', 'logs'] as const;
export const WORKSPACE_CHILD_DIRECTORIES = [
  'uploads',
  'generated',
  'scratch',
  'exports',
  'projects',
] as const;

export type HostPlatform = 'linux' | 'darwin' | 'win32';

export type WorkspaceEnv = {
  AGENT_PLATFORM_HOME?: string;
  AGENT_WORKSPACE_HOST_PATH?: string;
  AGENT_WORKSPACE_CONTAINER_PATH?: string;
  AGENT_DATA_HOST_PATH?: string;
  LOCALAPPDATA?: string;
  USERPROFILE?: string;
};

export type WorkspaceConfig = {
  platformHome: string;
  workspaceHostPath: string;
  workspaceContainerPath: string;
  dataHostPath: string;
  directories: readonly string[];
};

function normalizeNonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function defaultPlatformHome(
  platform: HostPlatform = process.platform as HostPlatform,
  env: WorkspaceEnv = process.env,
): string {
  switch (platform) {
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', 'AgentPlatform');
    case 'win32': {
      const localAppData = normalizeNonEmpty(env.LOCALAPPDATA);
      const userProfile = normalizeNonEmpty(env.USERPROFILE);
      return join(
        localAppData ?? (userProfile ? join(userProfile, 'AppData', 'Local') : homedir()),
        'AgentPlatform',
      );
    }
    case 'linux':
    default:
      return join(homedir(), '.agent-platform');
  }
}

export function resolveWorkspaceConfig(options?: {
  env?: WorkspaceEnv;
  platform?: HostPlatform;
}): WorkspaceConfig {
  const env = options?.env ?? process.env;
  const platform = options?.platform ?? (process.platform as HostPlatform);
  const platformHome = resolve(
    normalizeNonEmpty(env.AGENT_PLATFORM_HOME) ?? defaultPlatformHome(platform, env),
  );
  const workspaceHostPath = resolve(
    normalizeNonEmpty(env.AGENT_WORKSPACE_HOST_PATH) ?? join(platformHome, 'workspaces', 'default'),
  );
  const dataHostPath = resolve(
    normalizeNonEmpty(env.AGENT_DATA_HOST_PATH) ?? join(platformHome, 'data'),
  );
  const workspaceContainerPath =
    normalizeNonEmpty(env.AGENT_WORKSPACE_CONTAINER_PATH) ?? DEFAULT_WORKSPACE_CONTAINER_PATH;

  return {
    platformHome,
    workspaceHostPath,
    workspaceContainerPath,
    dataHostPath,
    directories: [
      ...WORKSPACE_SUBDIRECTORIES.map((dir) => join(platformHome, dir)),
      dataHostPath,
      workspaceHostPath,
      ...WORKSPACE_CHILD_DIRECTORIES.map((dir) => join(workspaceHostPath, dir)),
    ],
  };
}
