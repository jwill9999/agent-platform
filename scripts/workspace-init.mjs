#!/usr/bin/env node
import { chmodSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const DEFAULT_WORKSPACE_CONTAINER_PATH = '/workspace';
const WORKSPACE_SUBDIRECTORIES = ['config', 'logs'];
const WORKSPACE_CHILD_DIRECTORIES = ['uploads', 'generated', 'scratch', 'exports'];

function nonEmpty(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function defaultPlatformHome(platform = process.platform, env = process.env) {
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

function resolveWorkspaceConfig(env = process.env) {
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

const config = resolveWorkspaceConfig();

for (const directory of config.directories) {
  mkdirSync(directory, { recursive: true });
}

for (const directory of [
  config.dataHostPath,
  config.workspaceHostPath,
  ...WORKSPACE_CHILD_DIRECTORIES.map((dir) => join(config.workspaceHostPath, dir)),
]) {
  chmodSync(directory, 0o777);
}

console.log('Workspace storage ready');
console.log(`  platform home: ${config.platformHome}`);
console.log(`  workspace host path: ${config.workspaceHostPath}`);
console.log(`  workspace container path: ${config.workspaceContainerPath}`);
console.log(`  data host path: ${config.dataHostPath}`);
