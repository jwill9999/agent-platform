'use client';

import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/cn';

interface MarkdownProps {
  content: string;
  className?: string;
}

function CodeBlock({ className: codeClassName, children, ...props }: React.ComponentProps<'code'>) {
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
}

function MdParagraph({ children }: React.ComponentProps<'p'>) {
  return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
}

function MdUl({ children }: React.ComponentProps<'ul'>) {
  return <ul className="mb-3 list-disc pl-6 space-y-1">{children}</ul>;
}

function MdOl({ children }: React.ComponentProps<'ol'>) {
  return <ol className="mb-3 list-decimal pl-6 space-y-1">{children}</ol>;
}

function MdLi({ children }: React.ComponentProps<'li'>) {
  return <li className="leading-relaxed">{children}</li>;
}

function MdAnchor({ href, children }: React.ComponentProps<'a'>) {
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
}

function MdBlockquote({ children }: React.ComponentProps<'blockquote'>) {
  return (
    <blockquote className="border-l-2 border-border pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  );
}

function MdH1({ children }: React.ComponentProps<'h1'>) {
  return <h1 className="text-xl font-semibold mb-3 mt-4">{children}</h1>;
}

function MdH2({ children }: React.ComponentProps<'h2'>) {
  return <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>;
}

function MdH3({ children }: React.ComponentProps<'h3'>) {
  return <h3 className="text-base font-semibold mb-2 mt-3">{children}</h3>;
}

function MdStrong({ children }: React.ComponentProps<'strong'>) {
  return <strong className="font-semibold">{children}</strong>;
}

function MdEm({ children }: React.ComponentProps<'em'>) {
  return <em className="italic">{children}</em>;
}

const markdownComponents: Components = {
  code: CodeBlock,
  p: MdParagraph,
  ul: MdUl,
  ol: MdOl,
  li: MdLi,
  a: MdAnchor,
  blockquote: MdBlockquote,
  h1: MdH1,
  h2: MdH2,
  h3: MdH3,
  strong: MdStrong,
  em: MdEm,
};

export function Markdown({ content, className }: Readonly<MarkdownProps>) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
