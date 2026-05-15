import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  DesktopTerminalService,
  validateDesktopTerminalCreateRequest,
  validateDesktopTerminalInputRequest,
  validateDesktopTerminalResizeRequest,
} from '../src/main/terminalService.js';

describe('desktop terminal service', () => {
  it('validates terminal create requests without accepting shell commands', () => {
    expect(
      validateDesktopTerminalCreateRequest({
        projectId: 'project-1',
        cols: 120,
        rows: 32,
      }),
    ).toEqual({
      ok: true,
      value: {
        projectId: 'project-1',
        cols: 120,
        rows: 32,
      },
    });

    expect(
      validateDesktopTerminalCreateRequest({
        projectId: 'project-1',
        command: 'rm -rf /',
        cols: 120,
        rows: 32,
      }),
    ).toEqual({ ok: false, error: 'Terminal create payload contains unsupported fields.' });
  });

  it('validates terminal input and resize requests as terminal data only', () => {
    expect(validateDesktopTerminalInputRequest({ terminalId: 'term-1', data: 'pwd\r' })).toEqual({
      ok: true,
      value: { terminalId: 'term-1', data: 'pwd\r' },
    });
    expect(validateDesktopTerminalInputRequest({ terminalId: 'term-1', data: 1 })).toEqual({
      ok: false,
      error: 'Terminal input data is required.',
    });

    expect(
      validateDesktopTerminalResizeRequest({ terminalId: 'term-1', cols: 100, rows: 30 }),
    ).toEqual({
      ok: true,
      value: { terminalId: 'term-1', cols: 100, rows: 30 },
    });
    expect(
      validateDesktopTerminalResizeRequest({ terminalId: 'term-1', cols: 0, rows: 30 }),
    ).toEqual({
      ok: false,
      error: 'Terminal dimensions must be positive integers.',
    });
  });

  it('starts in the resolved Project root when the desktop backend knows it', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'agent-platform-terminal-project-'));
    const spawner = vi.fn(() => fakePty());
    const service = new DesktopTerminalService({
      fetchProjectRoot: vi.fn(async () => projectRoot),
      homedir: () => '/Users/tester',
      shellResolver: () => ({ shell: '/bin/zsh', args: [] }),
      spawnPty: spawner,
    });

    const result = await service.create({ projectId: 'project-1', cols: 90, rows: 28 });

    expect(result.cwd).toBe(realpathSync(projectRoot));
    expect(spawner).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: realpathSync(projectRoot),
        cols: 90,
        rows: 28,
      }),
    );
  });

  it('falls back to home when no Project root is available', async () => {
    const spawner = vi.fn(() => fakePty());
    const service = new DesktopTerminalService({
      fetchProjectRoot: vi.fn(async () => undefined),
      homedir: () => '/Users/tester',
      shellResolver: () => ({ shell: '/bin/zsh', args: [] }),
      spawnPty: spawner,
    });

    const result = await service.create({ cols: 80, rows: 24 });

    expect(result.cwd).toBe('/Users/tester');
    expect(spawner).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/Users/tester',
      }),
    );
  });
});

function fakePty() {
  return {
    pid: 1234,
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn(),
    onExit: vi.fn(),
  };
}
