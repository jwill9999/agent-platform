'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Terminal as TerminalIcon, X, Plus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
}

interface TerminalTab {
  id: string;
  name: string;
  history: TerminalLine[];
  commandHistory: string[];
  historyIndex: number;
}

export interface TerminalProps {
  onCommand?: (command: string) => Promise<string>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLineColor(type: TerminalLine['type']): string {
  switch (type) {
    case 'input':
      return 'text-cyan-400';
    case 'error':
      return 'text-red-400';
    case 'system':
      return 'text-muted-foreground italic';
    default:
      return 'text-foreground';
  }
}

function createWelcomeLine(): TerminalLine {
  return {
    id: 'welcome',
    type: 'system',
    content: 'Welcome to the integrated terminal. Type "help" for available commands.',
  };
}

function createLine(type: TerminalLine['type'], content: string): TerminalLine {
  return { id: `${Date.now()}-${Math.random()}`, type, content };
}

const HELP_TEXT = `Available commands:
  help     - Show this help message
  clear    - Clear the terminal
  echo     - Print text to terminal
  date     - Show current date and time
  pwd      - Print working directory
  ls       - List files (simulated)
  whoami   - Show current user`;

// ---------------------------------------------------------------------------
// Built-in command handler
// ---------------------------------------------------------------------------

function handleBuiltinCommand(command: string): { handled: boolean; output?: TerminalLine } {
  if (command === 'help') {
    return { handled: true, output: createLine('output', HELP_TEXT) };
  }
  if (command.startsWith('echo ')) {
    return { handled: true, output: createLine('output', command.slice(5)) };
  }
  if (command === 'date') {
    return { handled: true, output: createLine('output', new Date().toString()) };
  }
  if (command === 'pwd') {
    return { handled: true, output: createLine('output', '/home/user/project') };
  }
  if (command === 'ls') {
    return {
      handled: true,
      output: createLine('output', 'app/\ncomponents/\nlib/\npackage.json\ntsconfig.json'),
    };
  }
  if (command === 'whoami') {
    return { handled: true, output: createLine('output', 'developer') };
  }
  return { handled: false };
}

// ---------------------------------------------------------------------------
// Terminal component
// ---------------------------------------------------------------------------

export function Terminal({ onCommand, className }: Readonly<TerminalProps>) {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    {
      id: 'terminal-1',
      name: 'Terminal 1',
      history: [createWelcomeLine()],
      commandHistory: [],
      historyIndex: -1,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('terminal-1');
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeTab?.history.length]);

  const handleTerminalClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const appendLine = useCallback((tabId: string, line: TerminalLine) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, history: [...tab.history, line] } : tab,
      ),
    );
  }, []);

  const clearTab = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? { ...tab, history: [createLine('system', 'Terminal cleared.')] }
          : tab,
      ),
    );
  }, []);

  const handleCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;

      const trimmed = command.trim();

      // Record in command history
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? { ...tab, commandHistory: [...tab.commandHistory, trimmed], historyIndex: -1 }
            : tab,
        ),
      );

      appendLine(activeTabId, createLine('input', `$ ${trimmed}`));
      setInput('');
      setIsProcessing(true);

      if (trimmed === 'clear') {
        clearTab(activeTabId);
        setIsProcessing(false);
        return;
      }

      const builtin = handleBuiltinCommand(trimmed);
      if (builtin.handled) {
        if (builtin.output) appendLine(activeTabId, builtin.output);
        setIsProcessing(false);
        return;
      }

      if (onCommand) {
        try {
          const output = await onCommand(trimmed);
          appendLine(activeTabId, createLine('output', output));
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          appendLine(activeTabId, createLine('error', `Error: ${msg}`));
        }
      } else {
        appendLine(
          activeTabId,
          createLine('error', `Command not found: ${trimmed.split(' ')[0]}`),
        );
      }

      setIsProcessing(false);
    },
    [activeTabId, appendLine, clearTab, onCommand],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !isProcessing) {
        handleCommand(input);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const tab = tabs.find((t) => t.id === activeTabId);
        if (!tab || tab.commandHistory.length === 0) return;
        const newIndex =
          tab.historyIndex === -1
            ? tab.commandHistory.length - 1
            : Math.max(0, tab.historyIndex - 1);
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, historyIndex: newIndex } : t)),
        );
        setInput(tab.commandHistory[newIndex] ?? '');
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const tab = tabs.find((t) => t.id === activeTabId);
        if (!tab || tab.historyIndex === -1) return;
        const newIndex =
          tab.historyIndex >= tab.commandHistory.length - 1 ? -1 : tab.historyIndex + 1;
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, historyIndex: newIndex } : t)),
        );
        setInput(newIndex === -1 ? '' : (tab.commandHistory[newIndex] ?? ''));
      }
    },
    [input, isProcessing, handleCommand, tabs, activeTabId],
  );

  const addNewTab = useCallback(() => {
    const newId = `terminal-${Date.now()}`;
    const newTab: TerminalTab = {
      id: newId,
      name: `Terminal ${tabs.length + 1}`,
      history: [createLine('system', 'New terminal session started.')],
      commandHistory: [],
      historyIndex: -1,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  }, [tabs.length]);

  const closeTab = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (tabs.length === 1) return;

      setTabs((prev) => prev.filter((t) => t.id !== tabId));
      if (activeTabId === tabId) {
        const remaining = tabs.filter((t) => t.id !== tabId);
        setActiveTabId(remaining[0]?.id ?? '');
      }
    },
    [tabs, activeTabId],
  );

  return (
    <div className={cn('flex flex-col h-full bg-[#1e1e1e] text-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#252526] border-b border-[#3c3c3c]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTabId(tab.id);
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-1 text-xs rounded transition-colors',
                activeTabId === tab.id
                  ? 'bg-[#1e1e1e] text-white'
                  : 'text-[#969696] hover:text-white hover:bg-[#2d2d2d]',
              )}
            >
              <TerminalIcon className="h-3 w-3" />
              <span>{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    closeTab(tab.id, e);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-[#3c3c3c]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </button>
          ))}
          <button
            onClick={addNewTab}
            className="p-1 text-[#969696] hover:text-white hover:bg-[#2d2d2d] rounded"
            title="New Terminal"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[#969696] hover:text-white"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#252526] border-[#3c3c3c] text-white"
          >
            <DropdownMenuItem onClick={addNewTab} className="text-xs hover:bg-[#2d2d2d]">
              New Terminal
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                clearTab(activeTabId);
              }}
              className="text-xs hover:bg-[#2d2d2d]"
            >
              Clear Terminal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 font-mono text-sm cursor-text"
        onClick={handleTerminalClick}
        role="presentation"
      >
        {activeTab?.history.map((line) => (
          <div key={line.id} className={cn('whitespace-pre-wrap break-all', getLineColor(line.type))}>
            {line.content}
          </div>
        ))}

        <div className="flex items-center gap-2 mt-1">
          <span className="text-green-400">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            className="flex-1 bg-transparent outline-none text-white caret-white"
            placeholder={isProcessing ? 'Processing...' : ''}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
