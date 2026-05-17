'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Plus, Terminal as TerminalIcon, X } from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { getDesktopProjectBridge, hasDesktopTerminalBridge } from '@/lib/desktop-projects';

export interface ProjectTerminalDockProps {
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly activeBranch?: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onActivity?: () => void;
}

type TerminalState = 'starting' | 'open' | 'closed' | 'error' | 'unavailable';

interface TerminalTab {
  readonly id: string;
  readonly title: string;
  readonly state: TerminalState;
  readonly terminalId?: string;
  readonly cwd?: string;
  readonly error?: string;
}

interface TerminalRuntime {
  readonly term: XTerm;
  readonly fit: FitAddon;
  readonly inputDisposable: { dispose: () => void };
  readonly unsubscribeData: () => void;
  readonly unsubscribeExit: () => void;
}

const TERMINAL_FONT_OPTIONS = [
  {
    label: 'System Mono',
    value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  {
    label: 'MesloLGS NF',
    value: '"MesloLGS NF", "MesloLGS Nerd Font", ui-monospace, monospace',
  },
  {
    label: 'JetBrains Mono',
    value: '"JetBrains Mono", ui-monospace, monospace',
  },
  {
    label: 'Fira Code',
    value: '"Fira Code", ui-monospace, monospace',
  },
  {
    label: 'Menlo',
    value: 'Menlo, Monaco, Consolas, monospace',
  },
] as const;

function terminalStatusLabel(state: TerminalState): string {
  if (state === 'open') return 'Running';
  if (state === 'starting') return 'Starting';
  if (state === 'closed') return 'Closed';
  if (state === 'error') return 'Error';
  return 'Unavailable';
}

export function ProjectTerminalDock({
  projectId,
  projectName,
  activeBranch,
  open,
  onOpenChange,
  onActivity,
}: ProjectTerminalDockProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [height, setHeight] = useState(300);
  const [terminalFont, setTerminalFont] = useState<string>(TERMINAL_FONT_OPTIONS[0].value);
  const tabCounterRef = useRef(0);
  const runtimesRef = useRef(new Map<string, TerminalRuntime>());
  const containersRef = useRef(new Map<string, HTMLDivElement>());

  const updateTab = useCallback((tabId: string, patch: Partial<TerminalTab>) => {
    setTabs((current) => current.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab)));
  }, []);

  const disposeTabRuntime = useCallback((tab: TerminalTab) => {
    const runtime = runtimesRef.current.get(tab.id);
    if (runtime) {
      runtime.inputDisposable.dispose();
      runtime.unsubscribeData();
      runtime.unsubscribeExit();
      runtime.term.dispose();
      runtimesRef.current.delete(tab.id);
    }
    if (tab.terminalId) {
      void getDesktopProjectBridge()?.terminal?.dispose?.({ terminalId: tab.terminalId });
    }
  }, []);

  const disposeAllTabs = useCallback(() => {
    setTabs((current) => {
      for (const tab of current) {
        disposeTabRuntime(tab);
      }
      return [];
    });
    containersRef.current.clear();
    setActiveTabId(null);
  }, [disposeTabRuntime]);

  const addTab = useCallback(() => {
    tabCounterRef.current += 1;
    const id = `terminal-tab-${tabCounterRef.current}`;
    const title = `Terminal ${tabCounterRef.current}`;
    setTabs((current) => [...current, { id, title, state: 'starting' }]);
    setActiveTabId(id);
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((current) => {
        const target = current.find((tab) => tab.id === tabId);
        if (target) {
          disposeTabRuntime(target);
        }
        const nextTabs = current.filter((tab) => tab.id !== tabId);
        setActiveTabId((active) => {
          if (active !== tabId) return active;
          return nextTabs.at(-1)?.id ?? null;
        });
        if (nextTabs.length === 0) {
          onOpenChange(false);
        }
        return nextTabs;
      });
    },
    [disposeTabRuntime, onOpenChange],
  );

  const startTabRuntime = useCallback(
    (tab: TerminalTab, container: HTMLDivElement) => {
      if (runtimesRef.current.has(tab.id)) return;
      if (!hasDesktopTerminalBridge()) {
        updateTab(tab.id, { state: 'unavailable' });
        return;
      }
      const bridge = getDesktopProjectBridge()?.terminal;
      if (!bridge?.create || !bridge.input || !bridge.resize || !bridge.onData || !bridge.onExit) {
        updateTab(tab.id, { state: 'unavailable' });
        return;
      }

      const term = new XTerm({
        cursorBlink: true,
        fontFamily: terminalFont,
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
      fit.fit();

      let terminalId: string | null = null;
      const unsubscribeData = bridge.onData((event) => {
        if (event.terminalId === terminalId) {
          term.write(event.data);
          onActivity?.();
        }
      });
      const unsubscribeExit = bridge.onExit((event) => {
        if (event.terminalId === terminalId) {
          updateTab(tab.id, { state: 'closed', terminalId: undefined });
          onActivity?.();
        }
      });
      const inputDisposable = term.onData((data) => {
        if (terminalId) {
          void bridge.input?.({ terminalId, data });
        }
      });

      runtimesRef.current.set(tab.id, {
        term,
        fit,
        inputDisposable,
        unsubscribeData,
        unsubscribeExit,
      });

      bridge
        .create({
          ...(projectId ? { projectId } : {}),
          cols: Math.max(term.cols, 80),
          rows: Math.max(term.rows, 24),
        })
        .then((result) => {
          if (!runtimesRef.current.has(tab.id)) {
            void bridge.dispose?.({ terminalId: result.terminalId });
            return;
          }
          terminalId = result.terminalId;
          updateTab(tab.id, {
            cwd: result.cwd,
            state: 'open',
            terminalId: result.terminalId,
          });
          requestAnimationFrame(() => {
            fit.fit();
            void bridge.resize?.({
              terminalId: result.terminalId,
              cols: Math.max(term.cols, 2),
              rows: Math.max(term.rows, 2),
            });
          });
        })
        .catch((cause: unknown) => {
          updateTab(tab.id, {
            error: cause instanceof Error ? cause.message : 'Failed to start terminal.',
            state: 'error',
          });
        });
    },
    [onActivity, projectId, terminalFont, updateTab],
  );

  useEffect(() => {
    return () => {
      disposeAllTabs();
    };
  }, [disposeAllTabs]);

  useEffect(() => {
    disposeAllTabs();
    tabCounterRef.current = 0;
  }, [disposeAllTabs, projectId]);

  useEffect(() => {
    if (open && tabs.length === 0) {
      addTab();
    }
  }, [addTab, open, tabs.length]);

  useEffect(() => {
    if (!open) return;
    const activeRuntime = activeTabId ? runtimesRef.current.get(activeTabId) : undefined;
    if (!activeRuntime) return;
    requestAnimationFrame(() => activeRuntime.fit.fit());
  }, [activeTabId, open]);

  useEffect(() => {
    for (const runtime of runtimesRef.current.values()) {
      runtime.term.options.fontFamily = terminalFont;
      requestAnimationFrame(() => runtime.fit.fit());
    }
  }, [terminalFont]);

  useEffect(() => {
    if (!open) return;
    const resizeObserver = new ResizeObserver(() => {
      const activeRuntime = activeTabId ? runtimesRef.current.get(activeTabId) : undefined;
      const activeTab = tabs.find((tab) => tab.id === activeTabId);
      if (!activeRuntime || !activeTab?.terminalId) return;
      activeRuntime.fit.fit();
      void getDesktopProjectBridge()?.terminal?.resize?.({
        terminalId: activeTab.terminalId,
        cols: Math.max(activeRuntime.term.cols, 2),
        rows: Math.max(activeRuntime.term.rows, 2),
      });
    });

    for (const container of containersRef.current.values()) {
      resizeObserver.observe(container);
    }

    return () => resizeObserver.disconnect();
  }, [activeTabId, height, open, tabs]);

  if (!open && tabs.length === 0) return null;

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const activeState = activeTab?.state ?? 'closed';

  return (
    <section
      aria-label="Project terminal"
      className={cn('mb-4 border-t border-border bg-slate-950 text-slate-100', !open && 'hidden')}
      style={{ height }}
    >
      <div className="flex h-10 items-center gap-2 border-b border-slate-800 px-3 text-xs">
        <TerminalIcon className="h-4 w-4 shrink-0 text-slate-300" />
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'flex shrink-0 items-center rounded border border-transparent bg-slate-900',
                tab.id === activeTabId && 'border-slate-600 bg-slate-800',
              )}
            >
              <button
                type="button"
                className="px-3 py-1.5 text-left text-xs text-slate-100"
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.title}
              </button>
              <button
                type="button"
                className="px-1.5 text-slate-400 hover:text-slate-100"
                onClick={() => closeTab(tab.id)}
                title={`Close ${tab.title}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            onClick={addTab}
            title="New terminal"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="hidden min-w-0 max-w-[35%] truncate text-slate-400 lg:block">
          {projectName ?? 'Terminal'}
          {activeBranch ? ` · ${activeBranch}` : ''}
          {activeTab?.cwd ? ` · ${activeTab.cwd}` : ''}
        </div>
        <Select value={terminalFont} onValueChange={setTerminalFont}>
          <SelectTrigger
            aria-label="Terminal font"
            className="h-7 w-[150px] shrink-0 border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 shadow-none hover:bg-slate-800"
          >
            <SelectValue placeholder="Font" />
          </SelectTrigger>
          <SelectContent>
            {TERMINAL_FONT_OPTIONS.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span
          className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300"
          aria-label={`Terminal status: ${terminalStatusLabel(activeState)}`}
        >
          {terminalStatusLabel(activeState)}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          onClick={() => setHeight((value) => (value < 420 ? 480 : 300))}
          title="Toggle terminal height"
          aria-label="Toggle terminal height"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-7 px-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          onClick={() => onOpenChange(false)}
          title="Hide terminal"
          aria-label="Hide terminal"
        >
          Hide
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-7 px-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          onClick={() => {
            disposeAllTabs();
            onOpenChange(false);
          }}
          title="Close terminal"
          aria-label="Close terminal"
        >
          Close
        </Button>
      </div>
      {activeState === 'unavailable' ? (
        <div className="flex h-[calc(100%-2.5rem)] items-center justify-center text-sm text-slate-300">
          Native terminal is available in the desktop app.
        </div>
      ) : activeState === 'error' ? (
        <div className="p-4 text-sm text-red-200">
          {activeTab?.error ?? 'Terminal failed to start.'}
        </div>
      ) : (
        <div className="h-[calc(100%-2.5rem)] min-h-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              ref={(node) => {
                if (node) {
                  containersRef.current.set(tab.id, node);
                  startTabRuntime(tab, node);
                } else {
                  containersRef.current.delete(tab.id);
                }
              }}
              data-terminal-active={tab.id === activeTabId ? 'true' : 'false'}
              className={cn('h-full min-h-0 p-2', tab.id === activeTabId ? 'block' : 'hidden')}
            />
          ))}
        </div>
      )}
    </section>
  );
}
