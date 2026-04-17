import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveTerminalCwd } from '../src/infrastructure/terminal/resolveTerminalCwd.js';

describe('resolveTerminalCwd', () => {
  it('returns home when cwd query is empty', () => {
    expect(resolveTerminalCwd(null)).toBe(os.homedir());
    expect(resolveTerminalCwd('')).toBe(os.homedir());
  });

  it('returns home when cwd query is not a directory', () => {
    expect(resolveTerminalCwd('/this/path/should/not/exist/agent-platform-xyz')).toBe(os.homedir());
  });

  it('returns resolved path when cwd query is a real directory', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pty-cwd-'));
    try {
      expect(resolveTerminalCwd(tmp)).toBe(path.resolve(tmp));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('uses TERMINAL_CWD when cwd query invalid', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pty-env-'));
    const prev = process.env.TERMINAL_CWD;
    process.env.TERMINAL_CWD = tmp;
    try {
      expect(resolveTerminalCwd('/nonexistent-path-xyz')).toBe(path.resolve(tmp));
    } finally {
      if (prev === undefined) delete process.env.TERMINAL_CWD;
      else process.env.TERMINAL_CWD = prev;
      fs.rmSync(tmp, { recursive: true });
    }
  });
});
