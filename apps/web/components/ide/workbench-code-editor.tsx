'use client';

import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';

import type { WorkbenchLanguage } from '@/lib/code-workbench-editor';

export interface WorkbenchCodeEditorProps {
  value: string;
  language: WorkbenchLanguage;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

function languageExtension(language: WorkbenchLanguage): Extension {
  switch (language) {
    case 'typescript':
      return javascript({ jsx: true, typescript: true });
    case 'javascript':
      return javascript({ jsx: true });
    case 'json':
      return json();
    case 'css':
      return css();
    case 'html':
      return html();
    case 'markdown':
      return markdown();
    case 'python':
      return python();
    case 'plaintext':
      return [];
  }
}

const workbenchEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    minHeight: '0',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.5rem',
  },
  '.cm-content': {
    padding: '1rem 0',
    caretColor: 'var(--foreground)',
  },
  '.cm-line': {
    padding: '0 1rem',
  },
  '.cm-gutters': {
    backgroundColor: 'color-mix(in oklch, var(--muted) 42%, transparent)',
    color: 'var(--muted-foreground)',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'color-mix(in oklch, var(--primary) 12%, transparent)',
    color: 'var(--foreground)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in oklch, var(--primary) 7%, transparent)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklch, var(--primary) 30%, transparent)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--foreground)',
  },
});

export function WorkbenchCodeEditor({
  value,
  language,
  onChange,
  ariaLabel = 'Code editor',
}: Readonly<WorkbenchCodeEditorProps>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          languageExtension(language),
          workbenchEditorTheme,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ariaLabel, language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: value,
      },
    });
  }, [value]);

  return (
    <div
      ref={hostRef}
      data-testid="workbench-code-editor"
      className="flex-1 min-h-0 overflow-hidden bg-background"
    />
  );
}
