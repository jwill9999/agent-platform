'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import {
  FolderOpen,
  File,
  Save,
  X,
  ChevronRight,
  ChevronDown,
  FileCode,
  FileJson,
  FileText,
  FileType,
  Folder,
  Search,
  Send,
  Sparkles,
  PanelLeftClose,
  PanelRightClose,
  PanelBottomClose,
  Code2,
  MessageSquare,
  Plus,
  Paperclip,
  Menu,
  RefreshCw,
  Terminal as TerminalIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/cn';
import { IDEMarkdown } from '@/components/ide/ide-markdown';
import { Terminal } from '@/components/ide/terminal';
import { useSidebar } from '@/components/layout/sidebar-context';
import { useFileSystem } from '@/hooks/use-file-system';
import type { FileNode } from '@/hooks/use-file-system';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpenTab {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
  handle?: FileSystemFileHandle;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="h-4 w-4 text-blue-500" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-yellow-500" />;
    case 'md':
    case 'txt':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case 'css':
    case 'scss':
      return <FileType className="h-4 w-4 text-pink-500" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    default:
      return 'plaintext';
  }
}

function getMessageText(message: UIMessage): string {
  if (!message.parts) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

// Sample file tree (replaced by File System Access API in later task)
const sampleFileTree: FileNode[] = [
  {
    name: 'src',
    path: '/src',
    type: 'directory',
    children: [
      {
        name: 'index.ts',
        path: '/src/index.ts',
        type: 'file',
        content:
          "import { createApp } from './app';\n\nconst app = createApp();\n\napp.listen(3000, () => {\n  console.log('Server running on port 3000');\n});",
      },
      {
        name: 'app.ts',
        path: '/src/app.ts',
        type: 'file',
        content:
          "import express from 'express';\n\nexport function createApp() {\n  const app = express();\n\n  app.get('/', (req, res) => {\n    res.json({ message: 'Hello World' });\n  });\n\n  return app;\n}",
      },
      {
        name: 'utils',
        path: '/src/utils',
        type: 'directory',
        children: [
          {
            name: 'helpers.ts',
            path: '/src/utils/helpers.ts',
            type: 'file',
            content:
              'export function formatDate(date: Date): string {\n  return date.toISOString().split("T")[0];\n}\n\nexport function capitalize(str: string): string {\n  return str.charAt(0).toUpperCase() + str.slice(1);\n}',
          },
        ],
      },
    ],
  },
  {
    name: 'package.json',
    path: '/package.json',
    type: 'file',
    content: '{\n  "name": "my-project",\n  "version": "1.0.0",\n  "main": "src/index.ts"\n}',
  },
  {
    name: 'README.md',
    path: '/README.md',
    type: 'file',
    content: '# My Project\n\nA sample project for the IDE.\n',
  },
];

// ---------------------------------------------------------------------------
// FileTreeNode
// ---------------------------------------------------------------------------

function FileTreeNode({
  node,
  depth = 0,
  onFileSelect,
  onAddToContext,
  selectedPath,
  contextPaths,
}: Readonly<{
  node: FileNode;
  depth?: number;
  onFileSelect: (node: FileNode) => void;
  onAddToContext?: (node: FileNode) => void;
  selectedPath: string | null;
  contextPaths?: string[];
}>) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => {
            setIsExpanded(!isExpanded);
          }}
          className={cn(
            'flex items-center gap-1 w-full px-2 py-1 text-sm hover:bg-muted/50 rounded-md transition-colors',
            'text-left',
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Folder
            className={cn('h-4 w-4', isExpanded ? 'text-blue-500' : 'text-muted-foreground')}
          />
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileSelect={onFileSelect}
                onAddToContext={onAddToContext}
                selectedPath={selectedPath}
                contextPaths={contextPaths}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isInContext = contextPaths?.includes(node.path);

  return (
    <div
      className={cn(
        'flex items-center gap-1 group text-sm rounded-md transition-colors',
        selectedPath === node.path ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50',
      )}
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
    >
      <button
        onClick={() => {
          onFileSelect(node);
        }}
        className="flex items-center gap-2 flex-1 py-1 text-left truncate"
      >
        {getFileIcon(node.name)}
        <span className="truncate">{node.name}</span>
        {isInContext && <span className="text-xs text-primary/70 ml-1">(in context)</span>}
      </button>
      {onAddToContext && node.type === 'file' && !isInContext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToContext(node);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
          title="Add to context"
        >
          <Plus className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function getFolderButtonLabel(isLoading: boolean, rootName: string | null): string {
  if (isLoading) return 'Loading...';
  if (rootName) return `Close ${rootName}`;
  return 'Open Folder';
}

function IDEToolbar({
  sidebarCollapsed,
  toggleSidebar,
  showExplorer,
  setShowExplorer,
  showTerminal,
  setShowTerminal,
  showChat,
  setShowChat,
  activeFilePath,
  activeFileIsDirty,
  onSave,
  isPathDialogOpen,
  setIsPathDialogOpen,
  pathInput,
  setPathInput,
  onLoadFromPath,
  onOpenFolder,
  isLoadingFolder,
  rootName,
  fsSupported,
  onRefreshFolder,
  onCloseFolder,
}: Readonly<{
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  showExplorer: boolean;
  setShowExplorer: (v: boolean) => void;
  showTerminal: boolean;
  setShowTerminal: (v: boolean) => void;
  showChat: boolean;
  setShowChat: (v: boolean) => void;
  activeFilePath: string | null;
  activeFileIsDirty: boolean;
  onSave: () => void;
  isPathDialogOpen: boolean;
  setIsPathDialogOpen: (v: boolean) => void;
  pathInput: string;
  setPathInput: (v: string) => void;
  onLoadFromPath: () => void;
  onOpenFolder: () => void;
  isLoadingFolder: boolean;
  rootName: string | null;
  fsSupported: boolean;
  onRefreshFolder: () => void;
  onCloseFolder: () => void;
}>) {
  const menuProps = sidebarCollapsed
    ? { variant: 'ghost' as const, title: 'Show main menu', label: 'Menu' }
    : { variant: 'secondary' as const, title: 'Hide main menu', label: 'Hide' };

  const explorerVariant = showExplorer ? 'secondary' : 'ghost';
  const explorerTitle = showExplorer ? 'Hide file explorer' : 'Show file explorer';
  const explorerLabel = showExplorer ? 'Hide' : 'Files';
  const ExplorerIcon = showExplorer ? PanelLeftClose : Folder;

  const terminalVariant = showTerminal ? 'secondary' : 'ghost';
  const terminalTitle = showTerminal ? 'Hide terminal' : 'Show terminal';
  const terminalLabel = showTerminal ? 'Hide' : 'Terminal';
  const TermIcon = showTerminal ? PanelBottomClose : TerminalIcon;

  const chatVariant = showChat ? 'secondary' : 'ghost';
  const chatTitle = showChat ? 'Hide AI assistant' : 'Show AI assistant';
  const chatLabel = showChat ? 'Hide' : 'AI';
  const ChatIcon = showChat ? PanelRightClose : MessageSquare;

  const folderLabel = getFolderButtonLabel(isLoadingFolder, rootName);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
      <div className="flex items-center gap-2">
        <Button
          variant={menuProps.variant}
          size="sm"
          onClick={toggleSidebar}
          className="gap-2"
          title={menuProps.title}
        >
          <Menu className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{menuProps.label}</span>
        </Button>
        <div className="w-px h-5 bg-border" />
        <Button
          variant={explorerVariant}
          size="sm"
          onClick={() => {
            setShowExplorer(!showExplorer);
          }}
          className="gap-2"
          title={explorerTitle}
        >
          <ExplorerIcon className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{explorerLabel}</span>
        </Button>
        <Dialog open={isPathDialogOpen} onOpenChange={setIsPathDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              Open File
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open File from Path</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <Input
                placeholder="Enter file path (e.g., /src/index.ts)"
                value={pathInput}
                onChange={(e) => {
                  setPathInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onLoadFromPath();
                }}
              />
              <Button onClick={onLoadFromPath} className="w-full">
                Open File
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {fsSupported && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={rootName ? onCloseFolder : onOpenFolder}
            disabled={isLoadingFolder}
          >
            <FolderOpen className="h-4 w-4" />
            {folderLabel}
          </Button>
        )}
        {rootName && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshFolder}
            disabled={isLoadingFolder}
            title="Refresh file tree"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={onSave}
          disabled={!activeFileIsDirty}
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden md:block">
          {activeFilePath ?? 'No file open'}
        </span>
        <Button
          variant={terminalVariant}
          size="sm"
          onClick={() => {
            setShowTerminal(!showTerminal);
          }}
          className="gap-2"
          title={terminalTitle}
        >
          <TermIcon className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{terminalLabel}</span>
        </Button>
        <Button
          variant={chatVariant}
          size="sm"
          onClick={() => {
            setShowChat(!showChat);
          }}
          className="gap-2"
          title={chatTitle}
        >
          <ChatIcon className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{chatLabel}</span>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorTabs
// ---------------------------------------------------------------------------

function EditorTabs({
  openTabs,
  activeTab,
  setActiveTab,
  onCloseTab,
}: Readonly<{
  openTabs: OpenTab[];
  activeTab: string | null;
  setActiveTab: (path: string) => void;
  onCloseTab: (path: string, e: React.MouseEvent) => void;
}>) {
  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center border-b border-border bg-muted/30 overflow-x-auto">
      {openTabs.map((tab) => (
        <button
          key={tab.path}
          onClick={() => {
            setActiveTab(tab.path);
          }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm border-r border-border transition-colors hover:bg-muted/50',
            activeTab === tab.path ? 'bg-background text-foreground' : 'text-muted-foreground',
          )}
        >
          {getFileIcon(tab.name)}
          <span className="truncate max-w-[120px]">{tab.name}</span>
          {tab.isDirty && <span className="w-2 h-2 rounded-full bg-primary" />}
          <button
            onClick={(e) => {
              onCloseTab(tab.path, e);
            }}
            className="ml-1 p-0.5 rounded hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorPanel
// ---------------------------------------------------------------------------

function EditorPanel({
  activeFile,
  onContentChange,
  onOpenPathDialog,
}: Readonly<{
  activeFile: OpenTab | undefined;
  onContentChange: (content: string) => void;
  onOpenPathDialog: () => void;
}>) {
  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Code2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium mb-2">No file open</p>
          <p className="text-sm mb-4">Select a file from the explorer or open a file by path</p>
          <Button variant="outline" onClick={onOpenPathDialog} className="gap-2">
            <FileText className="h-4 w-4" />
            Open File
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-1 bg-muted/20 border-b border-border text-xs text-muted-foreground">
        <span>{activeFile.language}</span>
        <span>{activeFile.content.split('\n').length} lines</span>
      </div>
      <textarea
        value={activeFile.content}
        onChange={(e) => {
          onContentChange(e.target.value);
        }}
        className="flex-1 w-full p-4 font-mono text-sm resize-none bg-background text-foreground focus:outline-none leading-6"
        spellCheck={false}
        style={{ tabSize: 2 }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel
// ---------------------------------------------------------------------------

function ChatPanel({
  messages,
  isLoading,
  chatInput,
  setChatInput,
  onSendMessage,
  contextFiles,
  activeFile,
  onAddToContext,
  onRemoveFromContext,
  onClearContext,
  onApplyCode,
  onCreateFile,
}: Readonly<{
  messages: UIMessage[];
  isLoading: boolean;
  chatInput: string;
  setChatInput: (v: string) => void;
  onSendMessage: () => void;
  contextFiles: OpenTab[];
  activeFile: OpenTab | undefined;
  onAddToContext: (tab: OpenTab) => void;
  onRemoveFromContext: (path: string) => void;
  onClearContext: () => void;
  onApplyCode: (code: string, targetFile?: string) => void;
  onCreateFile: (code: string, suggestedName?: string) => void;
}>) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">AI Assistant</span>
          <span className="text-xs text-muted-foreground">
            {isLoading ? 'Thinking...' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-2">Ask about your code</p>
              <p className="text-xs text-muted-foreground">
                The assistant can see your open file
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'rounded-xl px-3 py-2 max-w-[85%] text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 border border-border/50',
                  )}
                >
                  {message.role === 'user' ? (
                    <span className="whitespace-pre-wrap">{getMessageText(message)}</span>
                  ) : (
                    <IDEMarkdown
                      content={getMessageText(message)}
                      contextFiles={[
                        ...contextFiles.map((f) => ({ path: f.path, name: f.name })),
                        ...(activeFile && !contextFiles.some((f) => f.path === activeFile.path)
                          ? [{ path: activeFile.path, name: activeFile.name }]
                          : []),
                      ]}
                      onApplyCode={onApplyCode}
                      onCreateFile={onCreateFile}
                    />
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border bg-card/30">
        <ContextFilesIndicator
          contextFiles={contextFiles}
          activeFile={activeFile}
          onRemoveFromContext={onRemoveFromContext}
        />
        <ContextActionButtons
          activeFile={activeFile}
          contextFiles={contextFiles}
          onAddToContext={onAddToContext}
          onClearContext={onClearContext}
        />
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask about your code..."
            value={chatInput}
            onChange={(e) => {
              setChatInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            className="min-h-[60px] max-h-[120px] text-sm resize-none"
          />
          <Button
            size="icon"
            onClick={onSendMessage}
            disabled={!chatInput.trim() || isLoading}
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context indicators (small sub-components)
// ---------------------------------------------------------------------------

function ContextFilesIndicator({
  contextFiles,
  activeFile,
  onRemoveFromContext,
}: Readonly<{
  contextFiles: OpenTab[];
  activeFile: OpenTab | undefined;
  onRemoveFromContext: (path: string) => void;
}>) {
  if (contextFiles.length === 0 && !activeFile) return null;

  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Paperclip className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Context files (visible to AI):</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {contextFiles.map((f) => (
          <div
            key={f.path}
            className="flex items-center gap-1 px-2 py-0.5 bg-secondary/70 rounded text-xs"
          >
            <FileCode className="h-3 w-3 text-muted-foreground" />
            <span className="truncate max-w-[100px]">{f.name}</span>
            <button
              onClick={() => {
                onRemoveFromContext(f.path);
              }}
              className="ml-0.5 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {activeFile && !contextFiles.some((f) => f.path === activeFile.path) && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-xs">
            <FileCode className="h-3 w-3 text-primary" />
            <span className="truncate max-w-[100px]">{activeFile.name}</span>
            <span className="text-muted-foreground">(active)</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ContextActionButtons({
  activeFile,
  contextFiles,
  onAddToContext,
  onClearContext,
}: Readonly<{
  activeFile: OpenTab | undefined;
  contextFiles: OpenTab[];
  onAddToContext: (tab: OpenTab) => void;
  onClearContext: () => void;
}>) {
  const showPinButton =
    activeFile && !contextFiles.some((f) => f.path === activeFile.path);
  const showClearButton = contextFiles.length > 0;

  if (!showPinButton && !showClearButton) return null;

  return (
    <div className="flex items-center gap-2 mb-2">
      {showPinButton && activeFile && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-7"
          onClick={() => {
            onAddToContext(activeFile);
          }}
        >
          <Plus className="h-3 w-3" />
          Pin {activeFile.name}
        </Button>
      )}
      {showClearButton && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs h-7 text-muted-foreground"
          onClick={onClearContext}
        >
          <X className="h-3 w-3" />
          Clear all
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main IDEWithChat component
// ---------------------------------------------------------------------------

export interface IDEWithChatProps {
  fileTree?: FileNode[];
}

const defaultModel = process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'gpt-4o-mini';

export function IDEWithChat({ fileTree: initialFileTree }: Readonly<IDEWithChatProps>) {
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebar();

  // File System Access API
  const fs = useFileSystem();

  // Use FS API tree when a directory is open, otherwise fall back to props or sample data
  const fileTree = fs.isDirectoryOpen ? fs.fileTree : (initialFileTree ?? sampleFileTree);

  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pathInput, setPathInput] = useState('');
  const [isPathDialogOpen, setIsPathDialogOpen] = useState(false);

  // Panel visibility
  const [showExplorer, setShowExplorer] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [contextFiles, setContextFiles] = useState<OpenTab[]>([]);

  const activeFile = openTabs.find((tab) => tab.path === activeTab);

  // Build context body for API
  const contextBody = useMemo(() => {
    const files: { file: string; code: string }[] = [];
    for (const f of contextFiles) {
      files.push({ file: f.path, code: f.content });
    }
    if (activeFile && !contextFiles.some((f) => f.path === activeFile.path)) {
      files.push({ file: activeFile.path, code: activeFile.content });
    }
    return files.length > 0 ? { files } : undefined;
  }, [contextFiles, activeFile]);

  const { messages, append, status } = useChat({
    api: '/api/chat',
    body: { model: defaultModel, context: contextBody },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // --- File operations ---

  const findFileByPath = useCallback(
    (path: string, nodes: FileNode[] = fileTree): FileNode | null => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
          const found = findFileByPath(path, node.children);
          if (found) return found;
        }
      }
      return null;
    },
    [fileTree],
  );

  const handleFileSelect = useCallback(
    async (node: FileNode) => {
      if (node.type !== 'file') return;
      const exists = openTabs.some((tab) => tab.path === node.path);
      if (!exists) {
        let content = node.content ?? '';
        // Read from filesystem if handle is available
        if (node.handle) {
          try {
            content = await fs.readFile(node);
          } catch {
            content = `// Failed to read ${node.path}\n`;
          }
        }
        const newTab: OpenTab = {
          path: node.path,
          name: node.name,
          content,
          isDirty: false,
          language: getLanguage(node.name),
          handle: node.handle as FileSystemFileHandle | undefined,
        };
        setOpenTabs((prev) => [...prev, newTab]);
      }
      setActiveTab(node.path);
    },
    [openTabs, fs],
  );

  const handleCloseTab = useCallback(
    (path: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setOpenTabs((prev) => prev.filter((tab) => tab.path !== path));
      if (activeTab === path) {
        const remaining = openTabs.filter((tab) => tab.path !== path);
        const last = remaining.length > 0 ? remaining[remaining.length - 1] : undefined;
        setActiveTab(last?.path ?? null);
      }
    },
    [activeTab, openTabs],
  );

  const handleContentChange = useCallback(
    (content: string) => {
      if (!activeTab) return;
      setOpenTabs((prev) =>
        prev.map((tab) => (tab.path === activeTab ? { ...tab, content, isDirty: true } : tab)),
      );
    },
    [activeTab],
  );

  const handleSave = useCallback(async () => {
    if (!activeTab || !activeFile) return;
    // Write to filesystem if handle is available
    if (activeFile.handle) {
      const node: FileNode = {
        name: activeFile.name,
        path: activeFile.path,
        type: 'file',
        handle: activeFile.handle,
      };
      await fs.writeFile(node, activeFile.content);
    }
    setOpenTabs((prev) =>
      prev.map((tab) => (tab.path === activeTab ? { ...tab, isDirty: false } : tab)),
    );
  }, [activeTab, activeFile, fs]);

  // --- Context management ---

  const handleAddToContext = useCallback(
    (tab: OpenTab) => {
      if (!contextFiles.some((f) => f.path === tab.path)) {
        setContextFiles((prev) => [...prev, tab]);
      }
    },
    [contextFiles],
  );

  const handleRemoveFromContext = useCallback((path: string) => {
    setContextFiles((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const handleClearContext = useCallback(() => {
    setContextFiles([]);
  }, []);

  // --- Code apply from AI ---

  const handleApplyCode = useCallback(
    (code: string, targetFile?: string) => {
      if (!targetFile) return;
      const existing = openTabs.find((tab) => tab.path === targetFile);
      if (existing) {
        setOpenTabs((prev) =>
          prev.map((tab) =>
            tab.path === targetFile ? { ...tab, content: code, isDirty: true } : tab,
          ),
        );
        setActiveTab(targetFile);
      } else {
        const name = targetFile.split('/').pop() ?? 'untitled';
        setOpenTabs((prev) => [
          ...prev,
          { path: targetFile, name, content: code, isDirty: true, language: getLanguage(name) },
        ]);
        setActiveTab(targetFile);
      }
    },
    [openTabs],
  );

  const handleCreateFile = useCallback((code: string, suggestedName = 'new-file.ts') => {
    const path = `/src/${suggestedName}`;
    setOpenTabs((prev) => [
      ...prev,
      {
        path,
        name: suggestedName,
        content: code,
        isDirty: true,
        language: getLanguage(suggestedName),
      },
    ]);
    setActiveTab(path);
  }, []);

  // --- Path dialog ---

  const handleLoadFromPath = useCallback(() => {
    if (!pathInput.trim()) return;
    const file = findFileByPath(pathInput);
    if (file?.type === 'file') {
      handleFileSelect(file);
    } else {
      const name = pathInput.split('/').pop() ?? 'untitled';
      setOpenTabs((prev) => [
        ...prev,
        {
          path: pathInput,
          name,
          content: `// File: ${pathInput}\n`,
          isDirty: false,
          language: getLanguage(name),
        },
      ]);
      setActiveTab(pathInput);
    }
    setPathInput('');
    setIsPathDialogOpen(false);
  }, [pathInput, findFileByPath, handleFileSelect]);

  // --- Chat send ---

  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    append({ role: 'user', content: chatInput });
    setChatInput('');
  }, [chatInput, append]);

  // --- Keyboard shortcuts ---

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [handleSave]);

  // --- Filter file tree by search ---

  const filteredFileTree = useMemo(() => {
    if (!searchQuery.trim()) return fileTree;

    function filterNodes(nodes: FileNode[]): FileNode[] {
      return nodes.reduce<FileNode[]>((acc, node) => {
        if (node.type === 'directory') {
          const filteredChildren = node.children ? filterNodes(node.children) : [];
          if (filteredChildren.length > 0) {
            acc.push({ ...node, children: filteredChildren });
          }
        } else if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          acc.push(node);
        }
        return acc;
      }, []);
    }

    return filterNodes(fileTree);
  }, [fileTree, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-background">
      <IDEToolbar
        sidebarCollapsed={sidebarCollapsed}
        toggleSidebar={toggleSidebar}
        showExplorer={showExplorer}
        setShowExplorer={setShowExplorer}
        showTerminal={showTerminal}
        setShowTerminal={setShowTerminal}
        showChat={showChat}
        setShowChat={setShowChat}
        activeFilePath={activeFile?.path ?? null}
        activeFileIsDirty={activeFile?.isDirty ?? false}
        onSave={handleSave}
        isPathDialogOpen={isPathDialogOpen}
        setIsPathDialogOpen={setIsPathDialogOpen}
        pathInput={pathInput}
        setPathInput={setPathInput}
        onLoadFromPath={handleLoadFromPath}
        onOpenFolder={fs.openDirectory}
        isLoadingFolder={fs.isLoading}
        rootName={fs.rootName}
        fsSupported={fs.isSupported}
        onRefreshFolder={fs.refresh}
        onCloseFolder={fs.closeDirectory}
      />

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* File Explorer */}
        {showExplorer && (
          <>
            <ResizablePanel defaultSize={15} minSize={10} maxSize={30}>
              <div className="flex flex-col h-full bg-card/30">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      className="pl-8 h-8 text-sm"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                      }}
                    />
                  </div>
                </div>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>{fs.rootName ?? 'Explorer'}</span>
                  {fs.isLoading && <span className="text-xs animate-pulse">Loading…</span>}
                </div>
                {fs.error && (
                  <div className="px-3 py-2 text-xs text-destructive">{fs.error}</div>
                )}
                <ScrollArea className="flex-1">
                  <div className="pb-4">
                    {filteredFileTree.map((node) => (
                      <FileTreeNode
                        key={node.path}
                        node={node}
                        onFileSelect={handleFileSelect}
                        onAddToContext={(n) => {
                          if (n.content) {
                            handleAddToContext({
                              path: n.path,
                              name: n.name,
                              content: n.content,
                              isDirty: false,
                              language: getLanguage(n.name),
                            });
                          }
                        }}
                        selectedPath={activeTab}
                        contextPaths={contextFiles.map((f) => f.path)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        {/* Editor + Terminal */}
        <ResizablePanel defaultSize={showChat ? 50 : 85}>
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize={showTerminal ? 70 : 100} minSize={30}>
              <div className="flex flex-col h-full overflow-hidden">
                <EditorTabs
                  openTabs={openTabs}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  onCloseTab={handleCloseTab}
                />
                <EditorPanel
                  activeFile={activeFile}
                  onContentChange={handleContentChange}
                  onOpenPathDialog={() => {
                    setIsPathDialogOpen(true);
                  }}
                />
              </div>
            </ResizablePanel>

            {showTerminal && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={15} maxSize={60}>
                  <Terminal />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>

        {/* Chat Panel */}
        {showChat && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                chatInput={chatInput}
                setChatInput={setChatInput}
                onSendMessage={handleSendMessage}
                contextFiles={contextFiles}
                activeFile={activeFile}
                onAddToContext={handleAddToContext}
                onRemoveFromContext={handleRemoveFromContext}
                onClearContext={handleClearContext}
                onApplyCode={handleApplyCode}
                onCreateFile={handleCreateFile}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
