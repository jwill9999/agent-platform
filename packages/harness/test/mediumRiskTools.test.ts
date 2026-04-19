import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile, mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  executeMediumRiskTool,
  MEDIUM_RISK_IDS,
  MEDIUM_RISK_TOOLS,
  MEDIUM_RISK_MAP,
} from '../src/tools/mediumRiskTools.js';

// ---------------------------------------------------------------------------
// Test workspace
// ---------------------------------------------------------------------------

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `medium-risk-test-${randomUUID()}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true }).catch(() => {});
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('medium-risk tool registration', () => {
  it('exports 5 tool definitions', () => {
    expect(MEDIUM_RISK_TOOLS).toHaveLength(5);
  });

  it('all tool IDs start with sys_', () => {
    for (const tool of MEDIUM_RISK_TOOLS) {
      expect(tool.id).toMatch(/^sys_/);
    }
  });

  it('all tools have medium risk tier in map', () => {
    for (const id of Object.values(MEDIUM_RISK_IDS)) {
      expect(MEDIUM_RISK_MAP[id]).toBe('medium');
    }
  });

  it('all tools have riskTier: medium on definition', () => {
    for (const tool of MEDIUM_RISK_TOOLS) {
      expect(tool.riskTier).toBe('medium');
    }
  });
});

// ---------------------------------------------------------------------------
// append_file
// ---------------------------------------------------------------------------

describe('sys_append_file', () => {
  it('appends content to an existing file', async () => {
    const filePath = join(testDir, 'existing.txt');
    await writeFile(filePath, 'original\n', 'utf-8');

    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.appendFile, {
      path: filePath,
      content: 'appended line\n',
    });

    expect(result).toMatchObject({ type: 'tool_result' });
    const contents = await readFile(filePath, 'utf-8');
    expect(contents).toBe('original\nappended line\n');
  });

  it('creates file if it does not exist', async () => {
    const filePath = join(testDir, 'new-file.txt');

    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.appendFile, {
      path: filePath,
      content: 'hello\n',
    });

    expect(result).toMatchObject({ type: 'tool_result' });
    const contents = await readFile(filePath, 'utf-8');
    expect(contents).toBe('hello\n');
  });

  it('returns error when path is empty', async () => {
    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.appendFile, {
      path: '',
      content: 'test',
    });
    expect(result).toMatchObject({ type: 'error', code: 'INVALID_ARGS' });
  });
});

// ---------------------------------------------------------------------------
// copy_file
// ---------------------------------------------------------------------------

describe('sys_copy_file', () => {
  it('copies a file from source to destination', async () => {
    const src = join(testDir, 'source.txt');
    const dest = join(testDir, 'dest.txt');
    await writeFile(src, 'copy me', 'utf-8');

    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.copyFile, {
      source: src,
      destination: dest,
    });

    expect(result).toMatchObject({ type: 'tool_result' });
    const contents = await readFile(dest, 'utf-8');
    expect(contents).toBe('copy me');
  });

  it('returns error when source does not exist', async () => {
    const src = join(testDir, 'nonexistent.txt');
    const dest = join(testDir, 'dest.txt');

    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.copyFile, {
      source: src,
      destination: dest,
    });

    expect(result).toMatchObject({ type: 'error', code: 'COPY_FAILED' });
  });

  it('returns error when source is empty', async () => {
    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.copyFile, {
      source: '',
      destination: '/tmp/dest.txt',
    });
    expect(result).toMatchObject({ type: 'error', code: 'INVALID_ARGS' });
  });
});

// ---------------------------------------------------------------------------
// create_directory
// ---------------------------------------------------------------------------

describe('sys_create_directory', () => {
  it('creates a directory', async () => {
    const dirPath = join(testDir, 'new-dir');

    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.createDirectory, {
      path: dirPath,
    });

    expect(result).toMatchObject({ type: 'tool_result' });
    const info = await stat(dirPath);
    expect(info.isDirectory()).toBe(true);
  });

  it('creates nested directories recursively', async () => {
    const dirPath = join(testDir, 'a', 'b', 'c');

    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.createDirectory, {
      path: dirPath,
    });

    expect(result).toMatchObject({ type: 'tool_result' });
    const info = await stat(dirPath);
    expect(info.isDirectory()).toBe(true);
  });

  it('succeeds even if directory already exists', async () => {
    const dirPath = join(testDir, 'already-exists');
    await mkdir(dirPath);

    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.createDirectory, {
      path: dirPath,
    });

    expect(result).toMatchObject({ type: 'tool_result' });
  });

  it('returns error when path is empty', async () => {
    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.createDirectory, {
      path: '',
    });
    expect(result).toMatchObject({ type: 'error', code: 'INVALID_ARGS' });
  });
});

// ---------------------------------------------------------------------------
// http_request
// ---------------------------------------------------------------------------

describe('sys_http_request', () => {
  it('blocks requests to metadata endpoints', async () => {
    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.httpRequest, {
      url: 'http://169.254.169.254/latest/meta-data/',
    });
    expect(result).toMatchObject({ type: 'error', code: 'URL_BLOCKED' });
  });

  it('blocks requests to localhost', async () => {
    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.httpRequest, {
      url: 'http://localhost:3000/api',
    });
    expect(result).toMatchObject({ type: 'error', code: 'URL_BLOCKED' });
  });

  it('blocks requests to private IPs', async () => {
    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.httpRequest, {
      url: 'http://192.168.1.1/admin',
    });
    expect(result).toMatchObject({ type: 'error', code: 'URL_BLOCKED' });
  });

  it('returns error when url is empty', async () => {
    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.httpRequest, {
      url: '',
    });
    expect(result).toMatchObject({ type: 'error', code: 'INVALID_ARGS' });
  });
});

// ---------------------------------------------------------------------------
// download_file
// ---------------------------------------------------------------------------

describe('sys_download_file', () => {
  it('blocks downloads from metadata endpoints', async () => {
    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.downloadFile, {
      url: 'http://169.254.169.254/latest/user-data',
      path: join(testDir, 'userdata'),
    });
    expect(result).toMatchObject({ type: 'error', code: 'URL_BLOCKED' });
  });

  it('blocks downloads from private IPs', async () => {
    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.downloadFile, {
      url: 'http://10.0.0.1/secret.key',
      path: join(testDir, 'secret.key'),
    });
    expect(result).toMatchObject({ type: 'error', code: 'URL_BLOCKED' });
  });

  it('returns error when url or path is empty', async () => {
    const result = await executeMediumRiskTool(MEDIUM_RISK_IDS.downloadFile, {
      url: '',
      path: '',
    });
    expect(result).toMatchObject({ type: 'error', code: 'INVALID_ARGS' });
  });
});

// ---------------------------------------------------------------------------
// executeMediumRiskTool routing
// ---------------------------------------------------------------------------

describe('executeMediumRiskTool', () => {
  it('returns null for unknown tool ID', async () => {
    const result = await executeMediumRiskTool('sys_unknown_tool', {});
    expect(result).toBeNull();
  });

  it('returns null for zero-risk tool ID', async () => {
    const result = await executeMediumRiskTool('sys_generate_uuid', {});
    expect(result).toBeNull();
  });
});
