/**
 * Default mount configuration for the agent platform.
 *
 * In Docker: `/workspace` is the main user-file workspace.
 * In dev: falls back to `process.cwd()`.
 */

import { resolve } from 'node:path';
import type { Mount } from './pathJail.js';
import { DEFAULT_WORKSPACE_CONTAINER_PATH } from './workspaceConfig.js';

const WORKSPACE_ROOT =
  process.env.WORKSPACE_ROOT ??
  process.env.AGENT_WORKSPACE_CONTAINER_PATH ??
  DEFAULT_WORKSPACE_CONTAINER_PATH;

export const DEFAULT_MOUNTS: Mount[] = [
  {
    label: 'workspace',
    hostPath: resolve(WORKSPACE_ROOT),
    permission: 'read_write',
  },
  {
    label: 'tmp',
    hostPath: '/tmp',
    permission: 'read_write',
  },
];

export { WORKSPACE_ROOT };
