'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Play, FileCode, FilePlus, Diff } from 'lucide-react';
import { useState, useCallback, createContext, useContext, useMemo } from 'react';
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

interface IDEMarkdownProps {
  content: string;
  className?: string;
  contextFiles?: ReadonlyArray<{ path: string; name: string }>;
  onApplyCode?: (code: string, targetFile?: string, mode?: 'replace' | 'insert') => void;
  onCreateFile?: (code: string, suggestedName?: string) => void;
  onShowDiff?: (code: string, targetFile?: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractFilename(language: string | undefined): { lang: string; filename?: string } {
  if (!language) return { lang: 'text' };
  const parts = language.split(':');
  if (parts.length > 1) {
    return { lang: parts[0] ?? 'text', filename: parts.slice(1).join(':') };
  }
  return { lang: language };
}

function detectFilenameFromCode(code: string): string | undefined {
  const patterns = [
    /^\/\/\s*(\S+\.[a-z]+)\s*$/im,
    /^\/\*\s*(\S+\.[a-z]+)\s*\*\/\s*$/im,
    /^#\s*(\S+\.[a-z]+)\s*$/im,
    /^<!--\s*(\S+\.[a-z]+)\s*-->\s*$/im,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(code);
    if (match) return match[1];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// CodeBlockWithApply
// ---------------------------------------------------------------------------

function CodeBlockApplyActions({
  matchingFile,
  contextFiles,
  onApply,
  onShowDiff,
  onCreateFile,
  applied,
}: Readonly<{
  matchingFile: { path: string; name: string } | undefined;
  contextFiles: ReadonlyArray<{ path: string; name: string }> | undefined;
  onApply: (targetFile?: string) => void;
  onShowDiff?: () => void;
  onCreateFile?: () => void;
  applied: boolean;
}>) {
  if (matchingFile && onShowDiff) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={onShowDiff} className="h-7 text-xs gap-1.5">
          <Diff className="h-3.5 w-3.5" />
          Diff
        </Button>
        <ApplyButton matchingFile={matchingFile} onApply={onApply} applied={applied} />
        {onCreateFile && <CreateFileButton onClick={onCreateFile} />}
      </>
    );
  }

  if (matchingFile) {
    return (
      <>
        <ApplyButton matchingFile={matchingFile} onApply={onApply} applied={applied} />
        {onCreateFile && <CreateFileButton onClick={onCreateFile} />}
      </>
    );
  }

  if (contextFiles && contextFiles.length > 0) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
              <FileCode className="h-3.5 w-3.5" />
              Apply to...
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {contextFiles.map((file) => (
              <DropdownMenuItem
                key={file.path}
                onClick={() => {
                  onApply(file.path);
                }}
              >
                <FileCode className="h-4 w-4 mr-2" />
                {file.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {onCreateFile && <CreateFileButton onClick={onCreateFile} />}
      </>
    );
  }

  if (onCreateFile) {
    return <CreateFileButton onClick={onCreateFile} />;
  }

  return null;
}

function ApplyButton({
  matchingFile,
  onApply,
  applied,
}: Readonly<{
  matchingFile: { name: string };
  onApply: (targetFile?: string) => void;
  applied: boolean;
}>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        onApply();
      }}
      className={cn('h-7 text-xs gap-1.5', applied && 'text-green-600')}
    >
      {applied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Applied
        </>
      ) : (
        <>
          <Play className="h-3.5 w-3.5" />
          Apply to {matchingFile.name}
        </>
      )}
    </Button>
  );
}

function CreateFileButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="h-7 text-xs gap-1.5">
      <FilePlus className="h-3.5 w-3.5" />
      New File
    </Button>
  );
}

function CodeBlockWithApply({
  language,
  value,
  contextFiles,
  onApplyCode,
  onCreateFile,
  onShowDiff,
}: Readonly<{
  language: string | undefined;
  value: string;
  contextFiles?: ReadonlyArray<{ path: string; name: string }>;
  onApplyCode?: (code: string, targetFile?: string, mode?: 'replace' | 'insert') => void;
  onCreateFile?: (code: string, suggestedName?: string) => void;
  onShowDiff?: (code: string, targetFile?: string) => void;
}>) {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const { lang, filename } = extractFilename(language);
  const detectedFilename = filename ?? detectFilenameFromCode(value);

  const matchingFile = contextFiles?.find(
    (f) => detectedFilename && (f.path.endsWith(detectedFilename) || f.name === detectedFilename),
  );

  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, [value]);

  const handleApply = useCallback(
    (targetFile?: string) => {
      onApplyCode?.(value, targetFile ?? matchingFile?.path, 'replace');
      setApplied(true);
      setTimeout(() => {
        setApplied(false);
      }, 2000);
    },
    [value, matchingFile?.path, onApplyCode],
  );

  const handleShowDiff = useCallback(() => {
    onShowDiff?.(value, matchingFile?.path);
  }, [value, matchingFile?.path, onShowDiff]);

  const handleCreateFile = useCallback(() => {
    const suggestedName = detectedFilename ?? `new-file.${lang}`;
    onCreateFile?.(value, suggestedName);
  }, [value, detectedFilename, lang, onCreateFile]);

  const hasActions = onApplyCode || onCreateFile || onShowDiff;

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-border bg-muted/30">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {lang}
          </span>
          {detectedFilename && (
            <span className="text-xs text-primary/70 font-mono">{detectedFilename}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasActions && (
            <CodeBlockApplyActions
              matchingFile={matchingFile}
              contextFiles={contextFiles}
              onApply={handleApply}
              onShowDiff={onShowDiff ? handleShowDiff : undefined}
              onCreateFile={onCreateFile ? handleCreateFile : undefined}
              applied={applied}
            />
          )}
          <button
            onClick={() => {
              copyToClipboard();
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={lang}
        style={oneLight}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'transparent',
          fontSize: '0.875rem',
        }}
        codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline code
// ---------------------------------------------------------------------------

function InlineCode({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <code className="px-1.5 py-0.5 rounded-md bg-muted text-sm font-mono text-foreground">
      {children}
    </code>
  );
}

// ---------------------------------------------------------------------------
// Markdown element renderers
// ---------------------------------------------------------------------------

function MarkdownParagraph({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>;
}

function MarkdownUnorderedList({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <ul className="mb-4 list-disc pl-6 space-y-2">{children}</ul>;
}

function MarkdownOrderedList({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <ol className="mb-4 list-decimal pl-6 space-y-2">{children}</ol>;
}

function MarkdownListItem({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <li className="leading-relaxed">{children}</li>;
}

function MarkdownH1({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <h1 className="text-2xl font-semibold mt-6 mb-4">{children}</h1>;
}

function MarkdownH2({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>;
}

function MarkdownH3({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>;
}

function MarkdownH4({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <h4 className="text-base font-semibold mt-3 mb-2">{children}</h4>;
}

function MarkdownBlockquote({ children }: Readonly<{ children?: React.ReactNode }>) {
  return (
    <blockquote className="border-l-4 border-primary/30 pl-4 my-4 italic text-muted-foreground">
      {children}
    </blockquote>
  );
}

function MarkdownAnchor({
  href,
  children,
}: Readonly<{ href?: string; children?: React.ReactNode }>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
    >
      {children}
    </a>
  );
}

function MarkdownTable({ children }: Readonly<{ children?: React.ReactNode }>) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function MarkdownThead({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <thead className="bg-muted/50">{children}</thead>;
}

function MarkdownTh({ children }: Readonly<{ children?: React.ReactNode }>) {
  return (
    <th className="px-4 py-2 text-left font-medium border-b border-border">{children}</th>
  );
}

function MarkdownTd({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <td className="px-4 py-2 border-b border-border last:border-b-0">{children}</td>;
}

function MarkdownHr() {
  return <hr className="my-6 border-border" />;
}

function MarkdownStrong({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <strong className="font-semibold">{children}</strong>;
}

function MarkdownEm({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <em className="italic">{children}</em>;
}

function MarkdownPre({ children }: Readonly<{ children?: React.ReactNode }>) {
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// IDEMarkdown — context for code block callbacks
// ---------------------------------------------------------------------------

interface IDEMarkdownContextValue {
  contextFiles?: ReadonlyArray<{ path: string; name: string }>;
  onApplyCode?: (code: string, targetFile?: string, mode?: 'replace' | 'insert') => void;
  onCreateFile?: (code: string, suggestedName?: string) => void;
  onShowDiff?: (code: string, targetFile?: string) => void;
}

const IDEMarkdownContext = createContext<IDEMarkdownContextValue>({});

function MarkdownCodeRenderer({
  className: codeClassName,
  children,
}: Readonly<{ className?: string; children?: React.ReactNode }>) {
  const { contextFiles, onApplyCode, onCreateFile, onShowDiff } = useContext(IDEMarkdownContext);
  const match = /language-(\w+)/.exec(codeClassName ?? '');
  const isInline = !match && !codeClassName;

  if (isInline) {
    return <InlineCode>{children}</InlineCode>;
  }

  return (
    <CodeBlockWithApply
      language={match?.[1]}
      value={String(children).replace(/\n$/, '')}
      contextFiles={contextFiles}
      onApplyCode={onApplyCode}
      onCreateFile={onCreateFile}
      onShowDiff={onShowDiff}
    />
  );
}

const MARKDOWN_COMPONENTS = {
  code: MarkdownCodeRenderer,
  pre: MarkdownPre,
  p: MarkdownParagraph,
  ul: MarkdownUnorderedList,
  ol: MarkdownOrderedList,
  li: MarkdownListItem,
  h1: MarkdownH1,
  h2: MarkdownH2,
  h3: MarkdownH3,
  h4: MarkdownH4,
  blockquote: MarkdownBlockquote,
  a: MarkdownAnchor,
  table: MarkdownTable,
  thead: MarkdownThead,
  th: MarkdownTh,
  td: MarkdownTd,
  hr: MarkdownHr,
  strong: MarkdownStrong,
  em: MarkdownEm,
} as const;

export function IDEMarkdown({
  content,
  className,
  contextFiles,
  onApplyCode,
  onCreateFile,
  onShowDiff,
}: Readonly<IDEMarkdownProps>) {
  const ctxValue = useMemo(
    () => ({ contextFiles, onApplyCode, onCreateFile, onShowDiff }),
    [contextFiles, onApplyCode, onCreateFile, onShowDiff],
  );

  return (
    <IDEMarkdownContext.Provider value={ctxValue}>
      <div className={cn('prose prose-sm max-w-none', className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
          {content}
        </ReactMarkdown>
      </div>
    </IDEMarkdownContext.Provider>
  );
}
