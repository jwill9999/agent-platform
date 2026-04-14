'use client';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

type Props = {
  language: string;
  content: string;
};

export function CodeBlock({ language, content }: Props) {
  const lang = language && language !== 'plaintext' ? language : 'typescript';
  return (
    <SyntaxHighlighter
      language={lang}
      style={oneDark}
      customStyle={{
        margin: '0.5rem 0',
        borderRadius: 8,
        fontSize: '0.8125rem',
        lineHeight: 1.45,
      }}
      codeTagProps={{ className: 'syntax-code' }}
    >
      {content}
    </SyntaxHighlighter>
  );
}
