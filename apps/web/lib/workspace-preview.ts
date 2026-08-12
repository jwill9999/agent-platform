import {
  parseWorkspaceResourceUri,
  type ProjectGitDiffMode,
  type WorkspaceResource,
} from '@agent-platform/contracts';

import { apiPath } from '@/lib/apiClient';

export type WorkspacePreviewKind =
  | 'html'
  | 'markdown'
  | 'pdf'
  | 'image'
  | 'text'
  | 'diff'
  | 'unsupported';

export type WorkspacePreviewMode = 'preview' | 'source' | 'diff' | 'fallback';

export type WorkspacePreviewDescriptor = Readonly<{
  kind: WorkspacePreviewKind;
  mode: WorkspacePreviewMode;
  label: string;
  description: string;
  canPreview: boolean;
}>;

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx']);
const HTML_EXTENSIONS = new Set(['.html', '.htm']);
const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);
const IMAGE_MIME_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const TEXT_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.css',
  '.csv',
  '.go',
  '.h',
  '.hpp',
  '.ini',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.log',
  '.mjs',
  '.py',
  '.rs',
  '.sh',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const SAFE_PREVIEW_PROTOCOLS = new Set(['http:', 'https:', 'blob:']);

function extensionOf(label: string): string {
  const lastDot = label.lastIndexOf('.');
  return lastDot >= 0 ? label.slice(lastDot).toLowerCase() : '';
}

function metadataString(resource: WorkspaceResource, key: string): string | undefined {
  const value = resource.metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizedRelativePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\/workspace\/?/, '');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    return undefined;
  }
  return normalized;
}

export function workspaceResourcePath(resource: WorkspaceResource): string | undefined {
  const metadataPath =
    normalizedRelativePath(metadataString(resource, 'relativePath')) ??
    normalizedRelativePath(metadataString(resource, 'path'));
  if (metadataPath) return metadataPath;
  try {
    return normalizedRelativePath(parseWorkspaceResourceUri(resource.uri).target);
  } catch {
    return undefined;
  }
}

export function workspaceResourceDisplayLabel(resource: WorkspaceResource): string {
  const path = workspaceResourcePath(resource);
  if (path) return path;
  const safeLabel = normalizedRelativePath(resource.label);
  return safeLabel ?? (resource.kind === 'diff' ? 'File changes' : 'Generated file');
}

export function workspaceResourceDiffMode(resource: WorkspaceResource): ProjectGitDiffMode {
  return metadataString(resource, 'mode') === 'staged' ? 'staged' : 'unstaged';
}

export function workspaceResourceInlineContent(resource: WorkspaceResource): string | undefined {
  return metadataString(resource, 'content') ?? metadataString(resource, 'diff');
}

export function safeWorkspacePreviewUrl(resource: WorkspaceResource): string | undefined {
  const value =
    metadataString(resource, 'previewUrl') ??
    metadataString(resource, 'url') ??
    metadataString(resource, 'externalFallbackUrl');
  if (!value) return undefined;
  if (value.startsWith('/')) return value.startsWith('//') ? undefined : value;
  try {
    const parsed = new URL(value);
    return SAFE_PREVIEW_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function workspaceResourceBinaryPreviewUrl(resource: WorkspaceResource): string | undefined {
  const explicit = safeWorkspacePreviewUrl(resource);
  if (explicit) return explicit;
  const path = workspaceResourcePath(resource);
  if (!path) return undefined;
  const params = new URLSearchParams({ path });
  return `${apiPath('projects', resource.projectId, 'files', 'preview')}?${params.toString()}`;
}

function resourceMimeType(resource: WorkspaceResource): string {
  return (metadataString(resource, 'mimeType') ?? '').toLowerCase();
}

function resourceName(resource: WorkspaceResource): string {
  return workspaceResourcePath(resource) ?? workspaceResourceDisplayLabel(resource);
}

export function workspacePreviewDescriptor(
  resource: WorkspaceResource,
): WorkspacePreviewDescriptor {
  if (resource.kind === 'diff') {
    return {
      kind: 'diff',
      mode: 'diff',
      label: 'Review changes',
      description: 'Open the file changes without modifying the repository.',
      canPreview: true,
    };
  }

  const mimeType = resourceMimeType(resource);
  const name = resourceName(resource);
  const extension = extensionOf(name);

  if (mimeType === 'application/pdf' || extension === '.pdf') {
    return {
      kind: 'pdf',
      mode: 'preview',
      label: 'Preview PDF',
      description: 'View this PDF beside the conversation.',
      canPreview: true,
    };
  }
  if (mimeType === 'text/html' || HTML_EXTENSIONS.has(extension)) {
    return {
      kind: 'html',
      mode: 'preview',
      label: 'Preview HTML',
      description: 'Open a safe HTML preview beside the conversation.',
      canPreview: true,
    };
  }
  if (IMAGE_MIME_TYPES.has(mimeType) || IMAGE_EXTENSIONS.has(extension)) {
    return {
      kind: 'image',
      mode: 'preview',
      label: 'View image',
      description: 'View this image beside the conversation.',
      canPreview: true,
    };
  }
  if (
    (resource.kind === 'preview' || resource.kind === 'webview') &&
    safeWorkspacePreviewUrl(resource)
  ) {
    return {
      kind: 'html',
      mode: 'preview',
      label: 'Open preview',
      description: 'Open a safe app preview beside the conversation.',
      canPreview: true,
    };
  }
  if (mimeType === 'text/markdown' || MARKDOWN_EXTENSIONS.has(extension)) {
    return {
      kind: 'markdown',
      mode: 'preview',
      label: 'Preview Markdown',
      description: 'Render this Markdown beside the conversation.',
      canPreview: true,
    };
  }
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/xml' ||
    TEXT_EXTENSIONS.has(extension)
  ) {
    return {
      kind: 'text',
      mode: 'source',
      label: 'Open source',
      description: 'Read this file beside the conversation.',
      canPreview: true,
    };
  }
  return {
    kind: 'unsupported',
    mode: 'fallback',
    label: 'Open file',
    description: 'This file cannot be previewed in the application.',
    canPreview: false,
  };
}
