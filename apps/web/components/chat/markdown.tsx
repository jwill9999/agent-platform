'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/cn';

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        code({ className: codeClassName, children, ...props }) {
          const match = /language-(\w+)/.exec(codeClassName ?? '');
          const code = String(children).replace(/\n$/, '');

          if (match) {
            return (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="rounded-lg text-sm !mt-2 !mb-2"
              >
                {code}
              </SyntaxHighlighter>
            );
          }

          return (
            <code
              className={cn(
                'bg-secondary px-1.5 py-0.5 rounded text-sm font-mono',
                codeClassName,
              )}
              {...props}
            >
              {children}
            </code>
          );
        },
        p({ children }) {
          return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
        },
        ul({ children }) {
          return <ul className="mb-3 list-disc pl-6 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mb-3 list-decimal pl-6 space-y-1">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-border pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          );
        },
        h1({ children }) {
          return <h1 className="text-xl font-semibold mb-3 mt-4">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-base font-semibold mb-2 mt-3">{children}</h3>;
        },
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic">{children}</em>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
