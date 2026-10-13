// @vitest-environment jsdom
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInput } from '../components/chat/chat-input';

vi.mock('../components/chat/agent-model-context', () => ({
  useAgentModelContext: () => ({ agents: [], modelConfigs: [] }),
}));
vi.mock('../components/chat/chat-agent-selector', () => ({ ChatAgentSelector: () => null }));
vi.mock('../components/chat/chat-model-selector', () => ({ ChatModelSelector: () => null }));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function typeDraft(value: string) {
  const textarea = container.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      textarea,
      value,
    );
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return textarea;
}
async function submit() {
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('composer admission', () => {
  it('retains the contextual Project textbox name and the default message name', async () => {
    const onSend = vi.fn().mockReturnValue(true);
    await act(async () =>
      root.render(
        createElement(ChatInput, {
          onSend,
          isLoading: false,
          placeholder: 'Ask about this Project...',
        }),
      ),
    );
    expect(container.querySelector('textarea')!.getAttribute('aria-label')).toBe(
      'Ask about this Project...',
    );
    expect(container.querySelector('button[type="submit"]')!.getAttribute('aria-label')).toBe(
      'Send message',
    );
    await act(async () => root.render(createElement(ChatInput, { onSend, isLoading: false })));
    expect(container.querySelector('textarea')!.getAttribute('aria-label')).toBe('Message');
  });

  it('keeps the draft when the synchronous caller refuses and clears only on acceptance', async () => {
    const onSend = vi.fn().mockReturnValue(false);
    await act(async () => root.render(createElement(ChatInput, { onSend, isLoading: false })));
    const textarea = await typeDraft('keep this draft');
    await submit();
    expect(onSend).toHaveBeenCalledWith('keep this draft');
    expect(textarea.value).toBe('keep this draft');
    onSend.mockReturnValue(true);
    await submit();
    expect(onSend).toHaveBeenCalledTimes(2);
    expect(textarea.value).toBe('');
  });

  it('allows drafting during restoration but refuses Send and Enter, and retries without submission', async () => {
    const onSend = vi.fn();
    const onRetryHistory = vi.fn();
    await act(async () =>
      root.render(
        createElement(ChatInput, {
          onSend,
          isLoading: false,
          canSend: false,
          onRetryHistory,
          statusText: 'Unable to restore chat history.',
        }),
      ),
    );
    const textarea = await typeDraft('retained during retry');
    expect(textarea.disabled).toBe(false);
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
      true,
    );
    await submit();
    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
    });
    const retry = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Retry history',
    )!;
    await act(async () => retry.click());
    expect(onRetryHistory).toHaveBeenCalledOnce();
    expect(onSend).not.toHaveBeenCalled();
    expect(textarea.value).toBe('retained during retry');
    expect(container.querySelector('output')!.textContent).toContain('Unable to restore');
  });

  it('does not submit Enter while composing an IME character', async () => {
    const onSend = vi.fn().mockReturnValue(true);
    await act(async () => root.render(createElement(ChatInput, { onSend, isLoading: false })));
    const textarea = await typeDraft('draft');
    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }),
      );
    });
    expect(onSend).not.toHaveBeenCalled();
    expect(textarea.value).toBe('draft');
  });
});
