/**
 * Default mount configuration for the agent platform.
 *
 * In Docker: `/app/workspace` is the main working directory.
 * In dev: falls back to `process.cwd()`.
 */

import { resolve } from 'node:path';
import type { Mount } from './pathJail.js';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? process.cwd();

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
