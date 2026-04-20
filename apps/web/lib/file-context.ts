/**
 * File-context sanitisation and formatting for IDE chat.
 *
 * Accepts the `context.files` array sent from the IDE frontend,
 * validates / sanitises each entry, and produces a single text block
 * that is prepended to the user message so the LLM can reason about
 * the referenced source files.
 *
 * Security considerations:
 * - Size limits per file and in aggregate prevent context-window flooding.
 * - Null bytes and non-printable control characters are stripped.
 * - File paths are normalised and traversal attempts are rejected.
 * - Content is wrapped in clearly delimited fences so the LLM treats
 *   it as user-provided data, not instructions.
 */

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Maximum number of files accepted in a single request. */
export const MAX_FILE_COUNT = 10;
/** Maximum size (in characters) of a single file's content. */
export const MAX_FILE_SIZE = 50_000; // ~50 KB
/** Maximum aggregate size (in characters) of all file contents. */
export const MAX_TOTAL_SIZE = 200_000; // ~200 KB

// ---------------------------------------------------------------------------
// Allowed text-file extensions (lowercase, without dot)
// ---------------------------------------------------------------------------

const TEXT_EXTENSIONS = new Set([
  // Languages
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'pyi',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'kts',
  'c',
  'h',
  'cpp',
  'hpp',
  'cc',
  'hh',
  'cs',
  'swift',
  'php',
  'lua',
  'r',
  'scala',
  'clj',
  'ex',
  'exs',
  'zig',
  'nim',
  'dart',
  'v',
  'hs',
  'elm',
  'erl',
  'hrl',
  // Web / markup
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'vue',
  'svelte',
  // Data / config
  'json',
  'jsonl',
  'yaml',
  'yml',
  'toml',
  'ini',
  'env',
  'xml',
  'csv',
  'tsv',
  'graphql',
  'gql',
  'proto',
  // Shell / infra
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'bat',
  'cmd',
  'dockerfile',
  'tf',
  'hcl',
  'nix',
  // Docs
  'md',
  'mdx',
  'rst',
  'txt',
  'adoc',
  'tex',
  'org',
  // Config files (often extensionless but commonly seen)
  'lock',
  'cfg',
  'conf',
  'editorconfig',
  'eslintrc',
  'prettierrc',
  'babelrc',
  'npmrc',
  // SQL
  'sql',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileContextEntry {
  file: string;
  code: string;
}

export interface SanitisedFile {
  path: string;
  code: string;
  language: string;
}

export interface SanitiseResult {
  files: SanitisedFile[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip null bytes and C0 control characters (except \n, \r, \t). */
function stripControlChars(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replaceAll(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/** Extract the extension from a file path (lowercase, no dot). */
function getExtension(filePath: string): string {
  const base = filePath.split('/').pop() ?? '';
  const dotIndex = base.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return base.slice(dotIndex + 1).toLowerCase();
}

/** Basic path normalisation – collapse `..` / `.` / double-slashes. */
function normalisePath(raw: string): { normalised: string; escaped: boolean } {
  const parts = raw.replaceAll('\\', '/').split('/');
  const isAbsolute = raw.startsWith('/');
  const result: string[] = [];
  let escapeCount = 0;
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') {
      if (result.length > 0) {
        result.pop();
      } else {
        escapeCount++;
      }
    } else {
      result.push(p);
    }
  }
  const prefix = isAbsolute ? '/' : '';
  return { normalised: prefix + result.join('/'), escaped: escapeCount > 0 };
}

/** Detect path traversal attempts that escape the root. */
function isTraversalAttempt(path: string): boolean {
  return normalisePath(path).escaped;
}

/** Normalise a path string (public-facing, returns just the string). */
function normalisePathString(path: string): string {
  return normalisePath(path).normalised;
}

/** Map file extension to a Markdown code-fence language tag. */
function extensionToLanguage(ext: string): string {
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    pyi: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    hpp: 'cpp',
    cc: 'cpp',
    hh: 'cpp',
    cs: 'csharp',
    swift: 'swift',
    php: 'php',
    lua: 'lua',
    r: 'r',
    scala: 'scala',
    clj: 'clojure',
    ex: 'elixir',
    exs: 'elixir',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    vue: 'vue',
    svelte: 'svelte',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    graphql: 'graphql',
    gql: 'graphql',
    proto: 'protobuf',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'fish',
    ps1: 'powershell',
    bat: 'batch',
    cmd: 'batch',
    dockerfile: 'dockerfile',
    tf: 'hcl',
    hcl: 'hcl',
    nix: 'nix',
    md: 'markdown',
    mdx: 'markdown',
    sql: 'sql',
  };
  return map[ext] ?? (ext || 'text');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate and sanitise file context entries.
 *
 * Returns a list of clean files and any warnings generated.
 */
export function sanitiseFileContext(entries: FileContextEntry[]): SanitiseResult {
  const warnings: string[] = [];
  const files: SanitisedFile[] = [];

  if (entries.length > MAX_FILE_COUNT) {
    warnings.push(
      `Too many files (${entries.length}). Only the first ${MAX_FILE_COUNT} will be included.`,
    );
  }

  let totalSize = 0;
  const toProcess = entries.slice(0, MAX_FILE_COUNT);

  for (const entry of toProcess) {
    // Path validation
    if (!entry.file || typeof entry.file !== 'string') {
      warnings.push('Skipped entry with missing file path.');
      continue;
    }

    if (isTraversalAttempt(entry.file)) {
      warnings.push(`Skipped "${entry.file}" — path traversal not allowed.`);
      continue;
    }

    const path = normalisePathString(entry.file);
    const ext = getExtension(path);
    // Allow extensionless config files but reject truly unknown binary extensions
    if (ext && !TEXT_EXTENSIONS.has(ext)) {
      warnings.push(`Skipped "${path}" — extension ".${ext}" is not an allowed text format.`);
      continue;
    }

    // Content validation
    if (typeof entry.code !== 'string') {
      warnings.push(`Skipped "${path}" — content is not a string.`);
      continue;
    }

    let code = entry.code;

    // Per-file size limit
    if (code.length > MAX_FILE_SIZE) {
      code = code.slice(0, MAX_FILE_SIZE);
      warnings.push(`Truncated "${path}" to ${MAX_FILE_SIZE} characters.`);
    }

    // Aggregate size limit
    if (totalSize + code.length > MAX_TOTAL_SIZE) {
      warnings.push(
        `Aggregate size limit reached (${MAX_TOTAL_SIZE} chars). Skipping remaining files.`,
      );
      break;
    }

    code = stripControlChars(code);
    totalSize += code.length;

    files.push({
      path,
      code,
      language: extensionToLanguage(ext),
    });
  }

  return { files, warnings };
}

/**
 * Format sanitised files into a text block to prepend to the user message.
 *
 * Uses clear XML-style delimiters so the LLM treats the content as
 * user-provided reference material rather than instructions.
 */
export function formatFileContext(files: SanitisedFile[]): string {
  if (files.length === 0) return '';

  const blocks = files.map((f) => `--- ${f.path} ---\n\`\`\`${f.language}\n${f.code}\n\`\`\``);

  return [
    '<file_context>',
    'The following files have been provided as context for your reference:',
    '',
    ...blocks,
    '</file_context>',
    '',
  ].join('\n');
}
