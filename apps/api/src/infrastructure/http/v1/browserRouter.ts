import { createReadStream } from 'node:fs';
import type { Dirent } from 'node:fs';
import { readdir, stat, readFile } from 'node:fs/promises';
import { basename, extname, join, posix, relative, resolve, sep } from 'node:path';

import {
  BrowserArtifactSummarySchema,
  BrowserArtifactsResponseSchema,
  BrowserEvidenceArtifactSchema,
  type BrowserArtifactSummary,
  type BrowserArtifactsResponse,
  type BrowserEvidenceArtifact,
} from '@agent-platform/contracts';
import { PathJail, WORKSPACE_ROOT } from '@agent-platform/harness';
import { Router } from 'express';

import { HttpError } from '../httpError.js';

export type BrowserRouterOptions = {
  workspaceRoot?: string;
};

const BROWSER_ARTIFACT_ROOT = '.agent-platform/browser';
const MAX_ARTIFACT_METADATA_FILES = 1_000;
const MAX_DEPTH = 4;

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

function normalizeBrowserRelativePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Browser artifact path is required');
  }
  if (trimmed.includes('\0')) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Browser artifact path is invalid');
  }
  if (trimmed.startsWith('/') || isWindowsAbsolutePath(trimmed)) {
    throw new HttpError(403, 'PATH_ACCESS_DENIED', 'Use a workspace-relative browser path');
  }
  const normalized = posix.normalize(trimmed.replaceAll('\\', '/'));
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    !normalized.startsWith(`${BROWSER_ARTIFACT_ROOT}/`)
  ) {
    throw new HttpError(403, 'PATH_ACCESS_DENIED', 'Path must stay inside browser artifacts');
  }
  if (normalized.endsWith('.json')) {
    throw new HttpError(403, 'PATH_ACCESS_DENIED', 'Browser artifact metadata is not downloadable');
  }
  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
}

function toWorkspaceRelative(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join('/');
}

function artifactPath(artifact: BrowserEvidenceArtifact, workspaceRoot: string): string {
  const fromMetadata = artifact.metadata.workspaceRelativePath;
  if (typeof fromMetadata === 'string' && fromMetadata.trim()) return fromMetadata;
  if (artifact.uri) return toWorkspaceRelative(workspaceRoot, artifact.uri);
  return join(BROWSER_ARTIFACT_ROOT, artifact.sessionId, artifact.id).split(sep).join('/');
}

function artifactContentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.txt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function toSummary(
  artifact: BrowserEvidenceArtifact,
  workspaceRoot: string,
): BrowserArtifactSummary {
  const path = artifactPath(artifact, workspaceRoot);
  return BrowserArtifactSummarySchema.parse({
    ...artifact,
    path,
    downloadPath: path,
  });
}

async function findArtifactMetadataFiles(root: string): Promise<string[]> {
  const browserRoot = join(root, BROWSER_ARTIFACT_ROOT);
  const files: string[] = [];

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || files.length >= MAX_ARTIFACT_METADATA_FILES) return;
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_ARTIFACT_METADATA_FILES) break;
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }

  await walk(browserRoot, 1);
  return files;
}

async function listArtifacts(options: {
  workspaceRoot: string;
  sessionId?: string;
}): Promise<BrowserArtifactsResponse> {
  const metadataFiles = await findArtifactMetadataFiles(options.workspaceRoot);
  const artifacts: BrowserArtifactSummary[] = [];

  for (const file of metadataFiles) {
    try {
      const parsed = BrowserEvidenceArtifactSchema.parse(JSON.parse(await readFile(file, 'utf-8')));
      if (options.sessionId && parsed.sessionId !== options.sessionId) continue;
      artifacts.push(toSummary(parsed, options.workspaceRoot));
    } catch {
      // Ignore malformed sidecars; the browser tool can regenerate future evidence.
    }
  }

  const grouped = new Map<string, BrowserArtifactSummary[]>();
  for (const artifact of artifacts) {
    const group = grouped.get(artifact.sessionId) ?? [];
    group.push(artifact);
    grouped.set(artifact.sessionId, group);
  }

  return BrowserArtifactsResponseSchema.parse({
    totalArtifacts: artifacts.length,
    sessions: [...grouped.entries()]
      .map(([sessionId, sessionArtifacts]) => {
        const sorted = sessionArtifacts.sort((a, b) => b.capturedAtMs - a.capturedAtMs);
        return {
          sessionId,
          artifactCount: sorted.length,
          latestCapturedAtMs: sorted[0]?.capturedAtMs,
          artifacts: sorted,
        };
      })
      .sort((a, b) => (b.latestCapturedAtMs ?? 0) - (a.latestCapturedAtMs ?? 0)),
  });
}

export function createBrowserRouter(options: BrowserRouterOptions = {}): Router {
  const router = Router();
  const workspaceRoot = resolve(options.workspaceRoot ?? WORKSPACE_ROOT);
  const jail = new PathJail([
    { label: 'workspace', hostPath: workspaceRoot, permission: 'read_write' },
  ]);

  router.get('/artifacts', async (req, res, next) => {
    try {
      const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
      res.json({ data: await listArtifacts({ workspaceRoot, sessionId }) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/artifacts/download', async (req, res, next) => {
    try {
      const rawPath = typeof req.query.path === 'string' ? req.query.path : '';
      const inline = req.query.disposition === 'inline';
      const relativePath = normalizeBrowserRelativePath(rawPath);
      const validation = await jail.validate(join(workspaceRoot, relativePath), 'read');
      if (!validation.allowed) {
        throw new HttpError(403, 'PATH_ACCESS_DENIED', 'Path must stay inside browser artifacts');
      }

      let fileStat: Awaited<ReturnType<typeof stat>>;
      try {
        fileStat = await stat(validation.resolvedPath);
      } catch {
        throw new HttpError(404, 'BROWSER_ARTIFACT_NOT_FOUND', 'Browser artifact not found');
      }
      if (!fileStat.isFile()) {
        throw new HttpError(400, 'BROWSER_ARTIFACT_INVALID', 'Only files can be downloaded');
      }

      res.setHeader(
        'Content-Type',
        inline ? artifactContentType(validation.resolvedPath) : 'application/octet-stream',
      );
      res.setHeader('Content-Length', String(fileStat.size));
      res.setHeader(
        'Content-Disposition',
        `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(
          basename(validation.resolvedPath),
        )}"`,
      );
      createReadStream(validation.resolvedPath).on('error', next).pipe(res);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
