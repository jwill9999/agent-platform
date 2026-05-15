'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Square, Terminal as TerminalIcon, X } from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { getDesktopProjectBridge, hasDesktopTerminalBridge } from '@/lib/desktop-projects';

export interface ProjectTerminalDockProps {
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly activeBranch?: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

type TerminalState = 'idle' | 'starting' | 'open' | 'closed' | 'error' | 'unavailable';

export function ProjectTerminalDock({
  projectId,
  projectName,
  activeBranch,
  open,
  onOpenChange,
}: ProjectTerminalDockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const [cwd, setCwd] = useState<string | null>(null);
  const [state, setState] = useState<TerminalState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [height, setHeight] = useState(300);

  const disposeTerminal = useCallback(async () => {
    const terminalId = terminalIdRef.current;
    terminalIdRef.current = null;
    if (terminalId) {
      await getDesktopProjectBridge()?.terminal?.dispose?.({ terminalId });
    }
    terminalRef.current?.dispose();
    terminalRef.current = null;
    fitRef.current = null;
    setCwd(null);
    setState('closed');
  }, []);

  useEffect(() => {
    return () => {
      void disposeTerminal();
    };
  }, [disposeTerminal]);

  useEffect(() => {
    void disposeTerminal();
  }, [disposeTerminal, projectId]);

  useEffect(() => {
    if (!open) return;
    if (terminalIdRef.current) {
      requestAnimationFrame(() => fitRef.current?.fit());
      return;
    }
    if (!hasDesktopTerminalBridge()) {
      setState('unavailable');
      return;
    }
    const bridge = getDesktopProjectBridge()?.terminal;
    const container = containerRef.current;
    if (!bridge?.create || !bridge.input || !bridge.resize || !bridge.onData || !bridge.onExit) {
      setState('unavailable');
      return;
    }
    if (!container) return;

    setState('starting');
    setError(null);
    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      scrollback: 5000,
      theme: {
        background: '#111827',
        foreground: '#e5e7eb',
        cursor: '#e5e7eb',
        selectionBackground: '#475569',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    terminalRef.current = term;
    fitRef.current = fit;
    fit.fit();

    let disposed = false;
    const unsubscribeData = bridge.onData((event) => {
      if (event.terminalId === terminalIdRef.current) {
        term.write(event.data);
      }
    });
    const unsubscribeExit = bridge.onExit((event) => {
      if (event.terminalId === terminalIdRef.current) {
        terminalIdRef.current = null;
        setState('closed');
      }
    });
    const inputDisposable = term.onData((data) => {
      const terminalId = terminalIdRef.current;
      if (terminalId) {
        void bridge.input?.({ terminalId, data });
      }
    });

    bridge
      .create({
        ...(projectId ? { projectId } : {}),
        cols: Math.max(term.cols, 80),
        rows: Math.max(term.rows, 24),
      })
      .then((result) => {
        if (disposed) {
          void bridge.dispose?.({ terminalId: result.terminalId });
          return;
        }
        terminalIdRef.current = result.terminalId;
        setCwd(result.cwd);
        setState('open');
        requestAnimationFrame(() => {
          fit.fit();
          const terminalId = terminalIdRef.current;
          if (terminalId) {
            void bridge.resize?.({
              terminalId,
              cols: Math.max(term.cols, 2),
              rows: Math.max(term.rows, 2),
            });
          }
        });
      })
      .catch((cause: unknown) => {
        setState('error');
        setError(cause instanceof Error ? cause.message : 'Failed to start terminal.');
      });

    return () => {
      disposed = true;
      inputDisposable.dispose();
      unsubscribeData();
      unsubscribeExit();
    };
  }, [open, projectId]);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      const fit = fitRef.current;
      const terminalId = terminalIdRef.current;
      if (!fit || !terminalId) return;
      fit.fit();
      void getDesktopProjectBridge()?.terminal?.resize?.({
        terminalId,
        cols: Math.max(terminalRef.current?.cols ?? 80, 2),
        rows: Math.max(terminalRef.current?.rows ?? 24, 2),
      });
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [open, height]);

  if (!open && !terminalIdRef.current) return null;

  return (
    <section
      aria-label="Project terminal"
      className={cn('border-t border-border bg-slate-950 text-slate-100', !open && 'hidden')}
      style={{ height }}
    >
      <div className="flex h-10 items-center gap-2 border-b border-slate-800 px-3 text-xs">
        <TerminalIcon className="h-4 w-4 shrink-0 text-slate-300" />
        <div className="min-w-0 flex-1 truncate">
          <span className="font-medium text-slate-100">{projectName ?? 'Terminal'}</span>
          {activeBranch ? <span className="text-slate-400"> · {activeBranch}</span> : null}
          {cwd ? <span className="text-slate-400"> · {cwd}</span> : null}
        </div>
        <span className="rounded bg-slate-800 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300">
          {state}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          onClick={() => setHeight((value) => (value < 420 ? 480 : 300))}
          title="Resize terminal"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          onClick={() => onOpenChange(false)}
          title="Hide terminal"
        >
          <Square className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          onClick={() => {
            void disposeTerminal();
            onOpenChange(false);
          }}
          title="Close terminal"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {state === 'unavailable' ? (
        <div className="flex h-[calc(100%-2.5rem)] items-center justify-center text-sm text-slate-300">
          Native terminal is available in the desktop app.
        </div>
      ) : state === 'error' ? (
        <div className="p-4 text-sm text-red-200">{error ?? 'Terminal failed to start.'}</div>
      ) : (
        <div ref={containerRef} className="h-[calc(100%-2.5rem)] min-h-0 p-2" />
      )}
    </section>
  );
}
