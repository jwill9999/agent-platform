import { describe, expect, it } from 'vitest';

import {
  sanitiseFileContext,
  formatFileContext,
  MAX_FILE_COUNT,
  MAX_FILE_SIZE,
} from '../lib/file-context';

// ---------------------------------------------------------------------------
// sanitiseFileContext
// ---------------------------------------------------------------------------

describe('sanitiseFileContext', () => {
  it('accepts valid files and returns sanitised entries', () => {
    const result = sanitiseFileContext([
      { file: '/src/index.ts', code: 'console.log("hello")' },
      { file: '/src/utils.py', code: 'def main(): pass' },
    ]);
    expect(result.files).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
    expect(result.files[0]!).toEqual({
      path: '/src/index.ts',
      code: 'console.log("hello")',
      language: 'typescript',
    });
    expect(result.files[1]!).toEqual({
      path: '/src/utils.py',
      code: 'def main(): pass',
      language: 'python',
    });
  });

  it('limits file count to MAX_FILE_COUNT', () => {
    const entries = Array.from({ length: MAX_FILE_COUNT + 5 }, (_, i) => ({
      file: `/src/file${i}.ts`,
      code: `// file ${i}`,
    }));
    const result = sanitiseFileContext(entries);
    expect(result.files).toHaveLength(MAX_FILE_COUNT);
    expect(result.warnings.some((w) => w.includes('Too many files'))).toBe(true);
  });

  it('truncates oversized file content', () => {
    const bigCode = 'x'.repeat(MAX_FILE_SIZE + 100);
    const result = sanitiseFileContext([{ file: '/big.ts', code: bigCode }]);
    expect(result.files[0]!.code).toHaveLength(MAX_FILE_SIZE);
    expect(result.warnings.some((w) => w.includes('Truncated'))).toBe(true);
  });

  it('rejects path traversal attempts', () => {
    const result = sanitiseFileContext([
      { file: '../../../etc/passwd', code: 'root:x:0:0' },
      { file: '/src/../../../secret', code: 'secret' },
    ]);
    expect(result.files).toHaveLength(0);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.every((w) => w.includes('traversal'))).toBe(true);
  });

  it('rejects non-text file extensions', () => {
    const result = sanitiseFileContext([
      { file: '/image.png', code: 'binary data' },
      { file: '/app.exe', code: 'binary data' },
    ]);
    expect(result.files).toHaveLength(0);
    expect(result.warnings.every((w) => w.includes('not an allowed text format'))).toBe(true);
  });

  it('strips control characters from content', () => {
    const result = sanitiseFileContext([
      { file: '/clean.ts', code: 'hello\x00world\x07test\nline2' },
    ]);
    expect(result.files[0]!.code).toBe('helloworldtest\nline2');
    // \x00, \x07 stripped; \n preserved
  });

  it('normalises file paths', () => {
    const result = sanitiseFileContext([{ file: '/src/./utils/../helpers/index.ts', code: 'ok' }]);
    expect(result.files[0]!.path).toBe('/src/helpers/index.ts');
  });

  it('skips entries with missing file path', () => {
    const result = sanitiseFileContext([{ file: '', code: 'code' }]);
    expect(result.files).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('missing file path'))).toBe(true);
  });

  it('allows extensionless files', () => {
    const result = sanitiseFileContext([
      { file: '/Makefile', code: 'all: build' },
      { file: '/Dockerfile', code: 'FROM node' },
    ]);
    // Extensionless files are allowed (common config files)
    expect(result.files).toHaveLength(2);
  });

  it('enforces aggregate size limit', () => {
    // Each file is MAX_FILE_SIZE chars; 4 files = 200K = MAX_TOTAL_SIZE exactly,
    // so the 5th file should be rejected.
    const result = sanitiseFileContext([
      { file: '/a.ts', code: 'x'.repeat(MAX_FILE_SIZE) },
      { file: '/b.ts', code: 'y'.repeat(MAX_FILE_SIZE) },
      { file: '/c.ts', code: 'z'.repeat(MAX_FILE_SIZE) },
      { file: '/d.ts', code: 'w'.repeat(MAX_FILE_SIZE) },
      { file: '/e.ts', code: 'v'.repeat(MAX_FILE_SIZE) },
    ]);
    expect(result.files).toHaveLength(4);
    expect(result.warnings.some((w) => w.includes('Aggregate size limit'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatFileContext
// ---------------------------------------------------------------------------

describe('formatFileContext', () => {
  it('returns empty string for no files', () => {
    expect(formatFileContext([])).toBe('');
  });

  it('formats files with delimiters and code fences', () => {
    const output = formatFileContext([
      { path: '/src/index.ts', code: 'console.log("hi")', language: 'typescript' },
    ]);
    expect(output).toContain('<file_context>');
    expect(output).toContain('</file_context>');
    expect(output).toContain('--- /src/index.ts ---');
    expect(output).toContain('```typescript');
    expect(output).toContain('console.log("hi")');
  });

  it('includes multiple files', () => {
    const output = formatFileContext([
      { path: '/a.ts', code: 'a', language: 'typescript' },
      { path: '/b.py', code: 'b', language: 'python' },
    ]);
    expect(output).toContain('--- /a.ts ---');
    expect(output).toContain('--- /b.py ---');
    expect(output).toContain('```typescript');
    expect(output).toContain('```python');
  });
});
