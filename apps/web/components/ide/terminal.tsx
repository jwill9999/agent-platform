'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as TerminalIcon, RefreshCw } from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TERMINAL_CWD_KEY = 'ide-terminal-cwd';

export interface TerminalProps {
  className?: string;
  /** When true and no saved cwd, show hint (browser FS API does not expose OS path). */
  explorerFolderOpen?: boolean;
}

const CTRL_PREFIX = 0x01;

function readStoredTerminalCwd(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(TERMINAL_CWD_KEY);
    return v?.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Host for API WebSocket. Prefer 127.0.0.1 when the page is opened as "localhost" so we avoid
 * IPv6 ::1 vs IPv4 listen mismatches that break ws://localhost:3000 on some setups.
 */
function getApiHostForTerminal(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_HOST?.trim();
  if (fromEnv) return fromEnv;
  if (typeof window === 'undefined') return '127.0.0.1';
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '[::1]') return '127.0.0.1';
  return hostname;
}

function getTerminalWsBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_TERMINAL_WS_URL?.trim();
  if (explicit) {
    try {
      const u = new URL(explicit);
      u.search = '';
      return u.toString();
    } catch {
      return explicit.split('?')[0] ?? explicit;
    }
  }
  if (typeof window === 'undefined') return '';
  const { protocol } = window.location;
  const apiPort = process.env.NEXT_PUBLIC_API_PORT ?? '3000';
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  const host = getApiHostForTerminal();
  return `${wsProto}//${host}:${apiPort}/ws/terminal`;
}

function buildTerminalWsUrl(appliedCwd: string | null): string {
  const base = getTerminalWsBaseUrl();
  const u = new URL(base);
  if (appliedCwd?.trim()) {
    u.searchParams.set('cwd', appliedCwd.trim());
  }
  return u.toString();
}

/** HTTP health URL matching the WebSocket host/port (for error hints). */
function healthHintUrlFromWsUrl(wsUrl: string): string {
  try {
    const u = new URL(wsUrl);
    const httpProto = u.protocol === 'wss:' ? 'https:' : 'http:';
    return `${httpProto}//${u.host}/health`;
  } catch {
    return 'http://127.0.0.1:3000/health';
  }
}

function formatTerminalFailure(wsUrl: string, closeCode: number, closeReason: string): string {
  const healthUrl = healthHintUrlFromWsUrl(wsUrl);
  const port = (() => {
    try {
      return new URL(wsUrl).port || (wsUrl.startsWith('wss:') ? '443' : '80');
    } catch {
      return '3000';
    }
  })();

  if (closeCode === 1006) {
    return (
      `Could not keep a WebSocket to the API terminal (${wsUrl}). ` +
      `Close code 1006 usually means the connection was refused or dropped before opening — often the browser cannot reach port ${port} on the API host. ` +
      `Open ${healthUrl} in this same browser (not only curl on another machine). If it fails here, the API is not reachable from the browser. ` +
      `With SSH or Cursor port forwarding, forward port ${port} (API) as well as the web port, or set NEXT_PUBLIC_TERMINAL_WS_URL to a ws: URL that reaches the API from this browser.`
    );
  }

  return (
    `Terminal WebSocket closed (${closeCode}${closeReason ? `: ${closeReason}` : ''}). URL: ${wsUrl}. ` +
    `Confirm ${healthUrl} loads in this browser. Start the API (make api / make up) or set NEXT_PUBLIC_TERMINAL_WS_URL if the API uses another host/port.`
  );
}

function sendResize(ws: WebSocket, cols: number, rows: number): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const payload = JSON.stringify({ type: 'resize', cols, rows });
  const body = new TextEncoder().encode(payload);
  const msg = new Uint8Array(1 + body.length);
  msg[0] = CTRL_PREFIX;
  msg.set(body, 1);
  ws.send(msg);
}

/**
 * Real shell via API WebSocket + node-pty. Optional `cwd` query selects PTY working directory;
 * default server-side is the user home directory when unset.
 */
export function Terminal({ className, explorerFolderOpen }: Readonly<TerminalProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [appliedCwd, setAppliedCwd] = useState<string | null>(readStoredTerminalCwd);
  const [cwdInput, setCwdInput] = useState(() => readStoredTerminalCwd() ?? '');

  useEffect(() => {
    setCwdInput(appliedCwd ?? '');
  }, [appliedCwd]);

  const connect = useCallback(() => {
    setStatus('connecting');
    setErrorText(null);
    setSessionKey((k) => k + 1);
  }, []);

  const applyWorkingDirectory = useCallback(() => {
    const trimmed = cwdInput.trim();
    try {
      if (trimmed) {
        sessionStorage.setItem(TERMINAL_CWD_KEY, trimmed);
      } else {
        sessionStorage.removeItem(TERMINAL_CWD_KEY);
      }
    } catch {
      // ignore
    }
    setAppliedCwd(trimmed || null);
    setSessionKey((k) => k + 1);
  }, [cwdInput]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);

    let closed = false;

    const fitUntilSized = () => {
      fit.fit();
      return term.cols >= 2 && term.rows >= 2;
    };
    if (!fitUntilSized()) {
      requestAnimationFrame(() => {
        if (closed) return;
        fitUntilSized();
      });
    }

    const url = buildTerminalWsUrl(appliedCwd);
    if (!url) {
      setStatus('error');
      setErrorText('Terminal WebSocket URL is not configured.');
      return () => {
        term.dispose();
      };
    }

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';

    let didOpen = false;

    ws.onopen = () => {
      if (closed) return;
      didOpen = true;
      setStatus('open');
      fit.fit();
      if (term.cols < 2 || term.rows < 2) {
        requestAnimationFrame(() => {
          if (closed) return;
          fit.fit();
          if (ws.readyState === WebSocket.OPEN) {
            sendResize(ws, Math.max(term.cols, 2), Math.max(term.rows, 2));
          }
        });
      } else {
        sendResize(ws, term.cols, term.rows);
      }
      term.focus();
    };

    ws.onmessage = (ev) => {
      if (closed) return;
      const data = ev.data;
      if (typeof data === 'string') {
        term.write(data);
      } else {
        term.write(new TextDecoder().decode(data as ArrayBuffer));
      }
    };

    ws.onerror = () => {
      if (closed) return;
      // Details come from onclose (code / reason); browser onerror has no payload.
    };

    ws.onclose = (ev) => {
      if (closed) return;
      if (!didOpen && ev.code !== 1000) {
        setStatus('error');
        setErrorText(formatTerminalFailure(url, ev.code, ev.reason));
        return;
      }
      if (didOpen && ev.code !== 1000) {
        setStatus('error');
        setErrorText(
          `Shell session closed (${ev.code}${ev.reason ? `: ${ev.reason}` : ''}). ` +
            `The PTY on the API host may have exited. Check API logs (pty.exit). Try Reconnect.`,
        );
        return;
      }
      setStatus('closed');
    };

    const sub = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const ro = new ResizeObserver(() => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN && term.cols >= 2 && term.rows >= 2) {
        sendResize(ws, term.cols, term.rows);
      }
    });
    ro.observe(container);

    const onWin = () => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN && term.cols >= 2 && term.rows >= 2) {
        sendResize(ws, term.cols, term.rows);
      }
    };
    window.addEventListener('resize', onWin);

    return () => {
      closed = true;
      window.removeEventListener('resize', onWin);
      ro.disconnect();
      sub.dispose();
      ws.close();
      term.dispose();
    };
  }, [sessionKey, appliedCwd]);

  const showExplorerHint = Boolean(explorerFolderOpen) && !appliedCwd;

  return (
    <div className={cn('flex flex-col h-full min-h-0 bg-[#1e1e1e]', className)}>
      <div className="flex items-center justify-between px-2 py-1 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#969696]">
          <TerminalIcon className="h-3.5 w-3.5" />
          <span>Shell (API PTY)</span>
          {status === 'connecting' && <span className="text-amber-400">Connecting…</span>}
          {status === 'open' && <span className="text-green-500">Connected</span>}
          {status === 'closed' && <span className="text-muted-foreground">Disconnected</span>}
          {status === 'error' && <span className="text-destructive">Error</span>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-[#969696] hover:text-white"
          onClick={connect}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reconnect
        </Button>
      </div>
      <div className="px-2 py-2 border-b border-[#3c3c3c] shrink-0 space-y-2">
        <div className="flex gap-2 items-center">
          <Input
            value={cwdInput}
            onChange={(e) => {
              setCwdInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyWorkingDirectory();
            }}
            placeholder="Shell working directory (absolute path, e.g. /Users/you/project)"
            className="h-8 text-xs font-mono bg-[#2d2d2d] border-[#3c3c3c] text-[#d4d4d4] placeholder:text-[#6b6b6b]"
            spellCheck={false}
            autoComplete="off"
            aria-label="Terminal working directory"
          />
          <Button type="button" size="sm" className="h-8 shrink-0 text-xs" onClick={applyWorkingDirectory}>
            Apply
          </Button>
        </div>
        <p className="text-[10px] leading-snug text-[#858585]">
          {showExplorerHint
            ? 'Browsers do not expose the folder path from Open Folder. Paste the same absolute path here so the shell matches the Explorer, or leave empty to use your home directory.'
            : 'Leave empty to use your home directory on the API machine (or set TERMINAL_CWD on the server).'}
        </p>
      </div>
      {errorText && (
        <div className="px-3 py-2 text-xs text-destructive border-b border-[#3c3c3c] shrink-0">{errorText}</div>
      )}
      <div
        ref={containerRef}
        className="flex-1 min-h-[12rem] min-w-0 w-full overflow-hidden p-1"
      />
    </div>
  );
}
