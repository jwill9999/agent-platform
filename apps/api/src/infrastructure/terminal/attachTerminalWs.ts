import fs from 'node:fs';
import type { Server } from 'node:http';
import { spawn } from 'node-pty';
import { WebSocketServer } from 'ws';

import { createLogger } from '@agent-platform/logger';

import { ensureNodePtySpawnHelperExecutable } from './ensureNodePtySpawnHelper.js';
import { resolveTerminalCwd } from './resolveTerminalCwd.js';

ensureNodePtySpawnHelperExecutable();

const log = createLogger('terminal-ws');

const PATH_PREFIX = '/ws/terminal';

/** Control messages from client start with 0x01 followed by JSON UTF-8. */
const CTRL_PREFIX = 0x01;

function defaultShellWin32(): string {
  return process.env.COMSPEC ?? 'cmd.exe';
}

/**
 * Prefer $SHELL when it exists and is executable; otherwise common paths.
 * The API process may not inherit the same PATH as an interactive terminal.
 */
function resolveShellPathUnix(): string {
  const preferred = process.env.SHELL?.trim();
  const candidates = [preferred, '/bin/zsh', '/bin/bash', '/bin/sh'].filter((p): p is string =>
    Boolean(p),
  );
  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        fs.accessSync(p, fs.constants.X_OK);
        return p;
      }
    } catch {
      continue;
    }
  }
  return '/bin/sh';
}

function baseName(p: string): string {
  return p.split(/[/\\]/).pop() ?? '';
}

function isBashOrZsh(shellPath: string): boolean {
  const b = baseName(shellPath);
  return b === 'bash' || b === 'zsh';
}

function spawnPty(
  shell: string,
  args: string[],
  cwd: string,
  cols: number,
  rows: number,
): ReturnType<typeof spawn> {
  return spawn(shell, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });
}

/**
 * Try several shells/argv — `posix_spawnp` can fail for bad paths or flags (e.g. `-i` on some setups).
 */
function uniqShellAttempts(attempts: [string, string[]][]): [string, string[]][] {
  const seen = new Set<string>();
  const out: [string, string[]][] = [];
  for (const pair of attempts) {
    const key = `${pair[0]}\0${pair[1].join('\0')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pair);
  }
  return out;
}

function spawnPtyWithFallbacks(cwd: string, cols: number, rows: number): ReturnType<typeof spawn> {
  if (process.platform === 'win32') {
    const shell = defaultShellWin32();
    return spawnPty(shell, [], cwd, cols, rows);
  }

  const resolved = resolveShellPathUnix();
  const attempts = uniqShellAttempts([
    [resolved, []],
    ...(isBashOrZsh(resolved) ? ([[resolved, ['-l']]] as [string, string[]][]) : []),
    ['/bin/zsh', []],
    ['/bin/bash', []],
    ['/bin/sh', []],
  ]);

  let lastErr: unknown;

  for (const [sh, args] of attempts) {
    try {
      if (!fs.existsSync(sh)) continue;
      fs.accessSync(sh, fs.constants.X_OK);
      const term = spawnPty(sh, args, cwd, cols, rows);
      log.info('pty.spawn', { shell: sh, shellArgs: args, cwd });
      return term;
    } catch (err) {
      lastErr = err;
      log.warn('pty.spawn_attempt_failed', {
        shell: sh,
        args,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`PTY spawn failed after fallbacks: ${message}`);
}

/**
 * Attach a WebSocket → PTY bridge at `/ws/terminal` on the same HTTP server as Express.
 * Runs a real shell on the API host (local demo / single-user MVP). Not a multi-tenant sandbox.
 */
export function attachTerminalWs(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = request.url ?? '';
    if (!url.startsWith(PATH_PREFIX)) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws, request) => {
    const cols = 80;
    const rows = 24;
    const base = `http://${request.headers.host ?? 'localhost'}`;
    const url = new URL(request.url ?? '/ws/terminal', base);
    const cwd = resolveTerminalCwd(url.searchParams.get('cwd'));

    let term: ReturnType<typeof spawn>;
    try {
      term = spawnPtyWithFallbacks(cwd, cols, rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('pty.spawn_failed', { message, cwd });
      ws.close(1011, `PTY failed: ${message.slice(0, 120)}`);
      return;
    }

    term.onData((data) => {
      if (ws.readyState === 1) {
        // WebSocket.OPEN
        ws.send(data);
      }
    });

    ws.on('message', (data) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      if (buf.length === 0) return;

      if (buf[0] === CTRL_PREFIX) {
        try {
          const json = JSON.parse(buf.slice(1).toString('utf8')) as {
            type?: string;
            cols?: number;
            rows?: number;
          };
          if (
            json.type === 'resize' &&
            typeof json.cols === 'number' &&
            typeof json.rows === 'number' &&
            json.cols > 0 &&
            json.rows > 0
          ) {
            term.resize(json.cols, json.rows);
          }
        } catch {
          // ignore malformed control frames
        }
        return;
      }

      term.write(buf.toString('utf8'));
    });

    ws.on('close', () => {
      term.kill();
      log.info('pty.closed');
    });

    term.onExit(({ exitCode, signal }) => {
      log.info('pty.exit', { exitCode, signal });
      ws.close();
    });
  });
}
