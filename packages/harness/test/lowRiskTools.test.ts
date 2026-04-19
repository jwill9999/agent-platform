import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeLowRiskTool, LOW_RISK_IDS, LOW_RISK_TOOLS } from '../src/tools/lowRiskTools.js';

describe('Low-risk tools', () => {
  it('has 3 tool definitions', () => {
    expect(LOW_RISK_TOOLS).toHaveLength(3);
  });

  it('all tools have riskTier low', () => {
    for (const tool of LOW_RISK_TOOLS) {
      expect(tool.riskTier).toBe('low');
    }
  });

  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'low-risk-test-'));
    await writeFile(join(tmpDir, 'test.txt'), 'hello world', 'utf-8');
    await mkdir(join(tmpDir, 'subdir'));
    await writeFile(join(tmpDir, 'subdir', 'nested.ts'), 'export {}', 'utf-8');
    await writeFile(join(tmpDir, 'subdir', 'other.js'), '// js', 'utf-8');
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('file_exists', () => {
    it('returns true for existing file', async () => {
      const result = await executeLowRiskTool(LOW_RISK_IDS.fileExists, {
        path: join(tmpDir, 'test.txt'),
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('tool_result');
      if (result!.type === 'tool_result') {
        expect(result!.data.exists).toBe(true);
      }
    });

    it('returns false for non-existing file', async () => {
      const result = await executeLowRiskTool(LOW_RISK_IDS.fileExists, {
        path: join(tmpDir, 'nope.txt'),
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.exists).toBe(false);
      }
    });

    it('returns true for existing directory', async () => {
      const result = await executeLowRiskTool(LOW_RISK_IDS.fileExists, {
        path: join(tmpDir, 'subdir'),
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.exists).toBe(true);
      }
    });

    it('returns error for empty path', async () => {
      const result = await executeLowRiskTool(LOW_RISK_IDS.fileExists, {
        path: '',
      });
      expect(result!.type).toBe('error');
    });
  });

  describe('file_info', () => {
    it('returns file metadata', async () => {
      const result = await executeLowRiskTool(LOW_RISK_IDS.fileInfo, {
        path: join(tmpDir, 'test.txt'),
      });
      expect(result!.type).toBe('tool_result');
      if (result!.type === 'tool_result') {
        expect(result!.data.type).toBe('file');
        expect(result!.data.size).toBe(11); // 'hello world'
        expect(result!.data.mode).toMatch(/^0\d{3}$/);
        expect(result!.data.createdAt).toBeTruthy();
        expect(result!.data.modifiedAt).toBeTruthy();
      }
    });

    it('returns directory metadata', async () => {
      const result = await executeLowRiskTool(LOW_RISK_IDS.fileInfo, {
        path: join(tmpDir, 'subdir'),
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.type).toBe('directory');
      }
    });

    it('returns error for non-existing file', async () => {
      const result = await executeLowRiskTool(LOW_RISK_IDS.fileInfo, {
        path: join(tmpDir, 'nope.txt'),
      });
      expect(result!.type).toBe('error');
    });
  });

  describe('find_files', () => {
    it('finds files matching pattern', async () => {
      const result = await executeLowRiskTool(LOW_RISK_IDS.findFiles, {
        directory: tmpDir,
        pattern: '.ts',
      });
      expect(result!.type).toBe('tool_result');
      if (result!.type === 'tool_result') {
        expect(result!.data.count).toBeGreaterThanOrEqual(1);
        expect(result!.data.files).toContain(join('subdir', 'nested.ts'));
      }
    });

    it('respects maxResults', async () => {
      const result = await executeLowRiskTool(LOW_RISK_IDS.findFiles, {
        directory: tmpDir,
        pattern: '.',
        maxResults: 1,
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.files.length).toBeLessThanOrEqual(1);
      }
    });

    it('returns empty for no matches', async () => {
      const result = await executeLowRiskTool(LOW_RISK_IDS.findFiles, {
        directory: tmpDir,
        pattern: 'zzz_nonexistent',
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.count).toBe(0);
        expect(result!.data.files).toEqual([]);
      }
    });

    it('returns error for empty pattern', async () => {
      const result = await executeLowRiskTool(LOW_RISK_IDS.findFiles, {
        directory: tmpDir,
        pattern: '',
      });
      expect(result!.type).toBe('error');
    });
  });

  it('returns null for unknown tool ID', async () => {
    const result = await executeLowRiskTool('sys_unknown', {});
    expect(result).toBeNull();
  });
});
