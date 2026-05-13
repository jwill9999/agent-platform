import { describe, expect, it } from 'vitest';

import { buildIdeChatMessage, ideChatUnavailableText } from '@/components/ide/ide-with-chat';

describe('buildIdeChatMessage', () => {
  it('sends slash commands without browser Project context', () => {
    const message = buildIdeChatMessage({
      userLine: '  /help  ',
      sanitisedFiles: [
        {
          path: '/src/App.tsx',
          code: 'export function App() { return null; }',
          language: 'typescript',
        },
      ],
    });

    expect(message).toBe('/help');
  });

  it('does not prepend browser Project context to normal chat', () => {
    const message = buildIdeChatMessage({
      userLine: 'assess this project',
      sanitisedFiles: [],
    });

    expect(message).toBe('assess this project');
  });

  it('prepends file context to normal chat and still preserves slash commands', () => {
    const sanitisedFiles = [
      {
        path: '/src/App.tsx',
        code: 'export function App() { return null; }',
        language: 'typescript',
      },
    ];

    expect(
      buildIdeChatMessage({
        userLine: 'summarise this file',
        sanitisedFiles,
      }),
    ).toContain('<file_context>');

    expect(
      buildIdeChatMessage({
        userLine: '/init',
        sanitisedFiles,
      }),
    ).toBe('/init');
  });
});

describe('ideChatUnavailableText', () => {
  it('keeps the IDE assistant from becoming a typed-but-unsendable input', () => {
    expect(
      ideChatUnavailableText({
        sessionReady: false,
        hasActiveProject: false,
      }),
    ).toBe('Open a Project to chat with the assistant.');

    expect(
      ideChatUnavailableText({
        sessionReady: false,
        hasActiveProject: true,
      }),
    ).toBe('Opening Project chat...');

    expect(
      ideChatUnavailableText({
        sessionReady: true,
        hasActiveProject: true,
      }),
    ).toBeNull();
  });
});
