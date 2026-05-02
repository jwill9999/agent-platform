import { createReadStream } from 'node:fs';
import type { Dirent } from 'node:fs';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { basename, join, posix, relative, resolve, sep } from 'node:path';

import type { WorkspaceArea, WorkspaceAreaListing, WorkspaceFile } from '@agent-platform/contracts';
import { WorkspaceAreaSchema } from '@agent-platform/contracts';
import { PathJail, WORKSPACE_CHILD_DIRECTORIES, WORKSPACE_ROOT } from '@agent-platform/harness';
import { Router } from 'express';

import { HttpError } from '../httpError.js';

const WORKSPACE_AREAS = ['uploads', 'generated', 'scratch', 'exports'] as const;
const AREA_LABELS: Record<WorkspaceArea, string> = {
  uploads: 'Uploads',
  generated: 'Generated',
  scratch: 'Scratch',
  exports: 'Exports',
};
const MAX_DEPTH = 6;
const MAX_FILES_PER_AREA = 500;

export type WorkspaceRouterOptions = {
  workspaceRoot?: string;
};

function isAsciiLetter(code: number | undefined): boolean {
  if (code === undefined) return false;
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isWindowsAbsolutePath(value: string): boolean {
  return (
    value.length >= 3 &&
    isAsciiLetter(value.codePointAt(0)) &&
    value[1] === ':' &&
    (value[2] === '\\' || value[2] === '/')
  );
}

function normalizeWorkspaceRelativePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Workspace file path is required');
  }
  if (trimmed.includes('\0')) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Workspace file path is invalid');
  }
  if (trimmed.startsWith('/') || isWindowsAbsolutePath(trimmed)) {
    throw new HttpError(403, 'PATH_ACCESS_DENIED', 'Use a workspace-relative file path');
  }

  const normalized = posix.normalize(trimmed.replaceAll('\\', '/'));
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new HttpError(403, 'PATH_ACCESS_DENIED', 'File path must stay inside the workspace');
  }
  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
}

function toWorkspaceRelative(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join('/');
}

async function ensureWorkspaceAreas(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  await Promise.all(
    WORKSPACE_CHILD_DIRECTORIES.map((dir) => mkdir(join(root, dir), { recursive: true })),
  );
}

async function listAreaFiles(options: {
  root: string;
  area: WorkspaceArea;
  jail: PathJail;
}): Promise<WorkspaceFile[]> {
  const areaRoot = join(options.root, options.area);
  const files: WorkspaceFile[] = [];

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES_PER_AREA) return;

    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES_PER_AREA) break;
      const absolutePath = join(directory, entry.name);
      const validation = await options.jail.validate(absolutePath, 'read');
      if (!validation.allowed) continue;

      let entryStat: Awaited<ReturnType<typeof stat>>;
      try {
        entryStat = await stat(validation.resolvedPath);
      } catch {
        continue;
      }

      const kind = entryStat.isDirectory() ? 'directory' : 'file';
      files.push({
        name: entry.name,
        path: toWorkspaceRelative(
          validation.mount?.hostPath ?? options.root,
          validation.resolvedPath,
        ),
        area: options.area,
        kind,
        size: kind === 'file' ? entryStat.size : 0,
        modifiedAt: entryStat.mtime.toISOString(),
      });

      if (kind === 'directory') {
        await walk(validation.resolvedPath, depth + 1);
      }
    }
  }

  await walk(areaRoot, 1);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function createWorkspaceRouter(options: WorkspaceRouterOptions = {}): Router {
  const router = Router();
  const workspaceRoot = resolve(options.workspaceRoot ?? WORKSPACE_ROOT);
  const jail = new PathJail([
    { label: 'workspace', hostPath: workspaceRoot, permission: 'read_write' },
  ]);

  router.get('/files', async (req, res, next) => {
    try {
      await ensureWorkspaceAreas(workspaceRoot);
      const areaQuery = typeof req.query.area === 'string' ? req.query.area : undefined;
      const areaFilter = areaQuery ? WorkspaceAreaSchema.parse(areaQuery) : undefined;
      const areas = (areaFilter ? [areaFilter] : WORKSPACE_AREAS).map((area) => area);
      const listings: WorkspaceAreaListing[] = [];

      for (const area of areas) {
        listings.push({
          area,
          label: AREA_LABELS[area],
          path: area,
          files: await listAreaFiles({ root: workspaceRoot, area, jail }),
        });
      }

      res.json({
        data: {
          areas: listings,
          totalFiles: listings.reduce(
            (sum, area) => sum + area.files.filter((file) => file.kind === 'file').length,
            0,
          ),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/files/download', async (req, res, next) => {
    try {
      const rawPath = typeof req.query.path === 'string' ? req.query.path : '';
      const relativePath = normalizeWorkspaceRelativePath(rawPath);
      const validation = await jail.validate(join(workspaceRoot, relativePath), 'read');
      if (!validation.allowed) {
        throw new HttpError(
          403,
          'PATH_ACCESS_DENIED',
          'That file is outside the approved workspace',
        );
      }

      let fileStat: Awaited<ReturnType<typeof stat>>;
      try {
        fileStat = await stat(validation.resolvedPath);
      } catch {
        throw new HttpError(404, 'WORKSPACE_FILE_NOT_FOUND', 'Workspace file not found');
      }
      if (!fileStat.isFile()) {
        throw new HttpError(400, 'WORKSPACE_FILE_INVALID', 'Only files can be downloaded');
      }

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', String(fileStat.size));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(basename(validation.resolvedPath))}"`,
      );
      createReadStream(validation.resolvedPath).on('error', next).pipe(res);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
