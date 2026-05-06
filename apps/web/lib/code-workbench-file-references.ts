export type WorkbenchFileReferenceStatus =
  | 'available'
  | 'no_workspace'
  | 'outside_workspace'
  | 'not_found'
  | 'directory'
  | 'unsupported';

export type WorkbenchFileReference = {
  original: string;
  path: string;
};

const TEXT_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'md',
  'mdx',
  'txt',
  'css',
  'scss',
  'html',
  'htm',
  'py',
  'yml',
  'yaml',
  'toml',
  'sh',
  'sql',
]);

function hasScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function trimReference(value: string): string {
  return value.trim().replaceAll(/^[`"']|[`"',.:;)]$/g, '');
}

function normaliseReference(value: string): string | null {
  const trimmed = trimReference(value);
  if (!trimmed || hasScheme(trimmed) || trimmed.includes('\0')) return null;
  const parts = trimmed.replaceAll('\\', '/').split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (resolved.length === 0) return null;
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  if (resolved.length === 0) return null;
  return `/${resolved.join('/')}`;
}

function looksLikePath(value: string): boolean {
  const trimmed = trimReference(value);
  if (trimmed.length < 2 || /\s/.test(trimmed)) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) return true;
  return /^[\w@.-]+\/[\w@./-]+$/.test(trimmed) || /^[\w@./-]+\.[a-z0-9]{1,12}$/i.test(trimmed);
}

export function parseWorkbenchFileReference(value: string): WorkbenchFileReference | null {
  if (!looksLikePath(value)) return null;
  const path = normaliseReference(value);
  if (!path) return null;
  return { original: trimReference(value), path };
}

export function isSupportedWorkbenchTextPath(path: string): boolean {
  const name = path.split('/').pop() ?? '';
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 0) return true;
  const ext = name.slice(dotIndex + 1).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}
