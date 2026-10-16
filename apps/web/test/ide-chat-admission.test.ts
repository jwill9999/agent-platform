// @vitest-environment jsdom
import React, { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Agent, ProjectDesktopRecord } from '@agent-platform/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDEWithChat } from '../components/ide/ide-with-chat';
import type { ApprovalCardState, ChatAdmission } from '../hooks/use-harness-chat';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  bind: vi.fn(),
  recent: vi.fn(),
  picker: vi.fn(),
  register: vi.fn(),
  send: vi.fn<(...args: unknown[]) => ChatAdmission>(),
  sessionId: null as string | null,
  setError: vi.fn(),
  decide: vi.fn(),
  canDecideApproval: false,
  approvals: {} as Record<string, ApprovalCardState[]>,
  messages: [
    { id: 'existing', role: 'user', parts: [{ type: 'text', text: 'Existing conversation' }] },
  ],
}));
vi.mock('../lib/apiClient', async (original) => ({
  ...(await original<typeof import('../lib/apiClient')>()),
  apiGet: mocks.get,
  apiPost: mocks.post,
}));
vi.mock('../lib/desktop-projects', () => ({
  hasDesktopProjectBridge: () => true,
  getDesktopProjectBridge: () => ({ projects: { selectFolder: mocks.picker } }),
  loadRecentDesktopProjects: mocks.recent,
  bindProjectSession: mocks.bind,
  registerDesktopProject: mocks.register,
}));
// Test the real IDE caller and input against the public admission boundary. The actual
// hook's generation, single-admission and stream behavior are covered in chat-lifecycle.
vi.mock('../hooks/use-harness-chat', () => ({
  useHarnessChat: (sessionId: string | null) => {
    mocks.sessionId = sessionId;
    return {
      messages: mocks.messages,
      sendMessage: mocks.send,
      status: 'ready',
      error: null,
      setError: mocks.setError,
      criticEventsByMessage: {},
      thinkingByMessage: {},
      toolEventsByMessage: {},
      workspaceEventsByMessage: {},
      approvalEventsByMessage: mocks.approvals,
      decideApproval: mocks.decide,
      canDecideApproval: mocks.canDecideApproval,
      canSend: Boolean(sessionId),
    };
  },
}));
vi.mock('../hooks/use-file-system', () => ({
  useFileSystem: () => ({
    isDirectoryOpen: false,
    fileTree: [],
    isLoading: false,
    rootName: null,
    error: null,
    needsFolderReconnect: false,
  }),
}));
vi.mock('../components/ui/resizable', () => {
  const passthrough = ({ children }: { children: ReactNode }) =>
    createElement('div', null, children);
  return {
    ResizablePanel: passthrough,
    ResizablePanelGroup: passthrough,
    ResizableHandle: () => null,
  };
});
vi.mock('../components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('../components/ui/dialog', () => ({
  Dialog: () => null,
  DialogContent: () => null,
  DialogHeader: () => null,
  DialogTitle: () => null,
  DialogTrigger: () => null,
}));
vi.mock('../components/chat/chat-agent-selector', () => ({ ChatAgentSelector: () => null }));
vi.mock('../components/chat/workspace-resource-cards', () => ({
  WorkspaceResourcePreviewProvider: ({ children }: { children: ReactNode }) => children,
  WorkspaceResourceCards: () => null,
}));
vi.mock('../components/ide/terminal', () => ({ Terminal: () => null }));
vi.mock('../components/ide/workbench-code-editor', () => ({ WorkbenchCodeEditor: () => null }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function project(id: string, name = `Project ${id}`): ProjectDesktopRecord {
  return {
    id,
    slug: id,
    name,
    workspacePath: `/fixture/${id}`,
    createdAtMs: 1,
    updatedAtMs: 1,
    metadata: {
      source: 'desktop',
      folderName: id,
      capabilityState: 'backend_accessible',
      onboardingState: 'approved',
      defaultAgentProfile: 'coding',
      instructionFileCount: 1,
      workspaceProfile: 'coding_project',
      workspaceCapabilities: [],
    },
  };
}
const agent: Agent = {
  id: 'coding',
  slug: 'coding',
  name: 'Coding',
  systemPrompt: 'Test',
  allowedSkillIds: [],
  allowedToolIds: [],
  allowedMcpServerIds: [],
  executionLimits: { maxSteps: 1, maxParallelTasks: 1, timeoutMs: 1000 },
};
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  mocks.canDecideApproval = false;
  mocks.approvals = {};
  mocks.messages = [
    { id: 'existing', role: 'user', parts: [{ type: 'text', text: 'Existing conversation' }] },
  ];
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  mocks.sessionId = null;
  window.history.replaceState(null, '', '/ide?projectId=alpha');
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  mocks.get.mockImplementation(async (path: string) => {
    if (path === '/api/v1/agents') return [agent];
    if (path.endsWith('/files/tree')) return { files: [] };
    if (path === '/api/v1/projects/alpha') return project('alpha');
    throw new Error(`Unexpected fixture GET ${path}`);
  });
  mocks.bind.mockImplementation(async ({ projectId }: { projectId: string }) => ({
    created: true,
    session: {
      id: `bound-${projectId}`,
      agentId: 'coding',
      mode: 'project',
      projectId,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  }));
  mocks.recent.mockResolvedValue([project('alpha'), project('beta')]);
  mocks.register.mockResolvedValue({ project: project('beta'), created: false });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(IDEWithChat)));
  expect(mocks.sessionId).toBe('bound-alpha');
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  vi.restoreAllMocks();
});
function input() {
  const element = container.querySelector<HTMLTextAreaElement>(
    'textarea[placeholder="Ask about your code..."]',
  );
  if (!element) throw new Error(`Missing enabled IDE input: ${container.textContent}`);
  return element;
}
async function draft(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      input(),
      value,
    );
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function send() {
  await act(async () =>
    input().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    ),
  );
}
function admission() {
  const pending = deferred<void>();
  const ownedSession = mocks.sessionId;
  const isCurrent = () => mocks.sessionId === ownedSession;
  mocks.send.mockReturnValue({ accepted: true, completion: pending.promise, isCurrent });
  return pending;
}
async function changeProject() {
  const button = [...container.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === 'Change Project',
  );
  if (!button) throw new Error('Missing Change Project button');
  await act(async () => button.click());
}
async function switchToBeta() {
  mocks.picker.mockResolvedValueOnce({
    canceled: false,
    folder: { path: '/fixture/beta', name: 'beta' },
  });
  await changeProject();
  expect(mocks.sessionId).toBe('bound-beta');
  expect(container.textContent).toContain('Project beta');
}

describe('mounted IDE chat caller admission', () => {
  it('disables historical approval actions until the shared hook admits decisions', async () => {
    mocks.messages = [
      {
        id: 'pending-assistant',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Review action' }],
      },
    ];
    mocks.approvals = {
      'pending-assistant': [
        {
          type: 'approval_required',
          approvalRequestId: 'pending-approval',
          toolName: 'fixture:effect',
          argsPreview: {},
          status: 'pending',
        },
      ],
    };
    await act(async () => root.render(createElement(IDEWithChat)));
    const deny = () =>
      [...container.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Deny',
      )!;
    expect(deny()).toBeDefined();
    expect(deny().disabled).toBe(true);
    await act(async () => deny().click());
    expect(mocks.decide).not.toHaveBeenCalled();
    mocks.canDecideApproval = true;
    await act(async () => root.render(createElement(IDEWithChat)));
    expect(deny().disabled).toBe(false);
    await act(async () => deny().click());
    expect(mocks.decide).toHaveBeenCalledTimes(1);
    expect(mocks.decide).toHaveBeenCalledWith('pending-approval', 'reject');
  });

  it('keeps a refused draft and clears it only when synchronous admission accepts', async () => {
    mocks.send.mockReturnValueOnce({ accepted: false, reason: 'busy' });
    await draft('Keep my draft');
    await send();
    expect(mocks.send).toHaveBeenCalledWith('Keep my draft', 'Keep my draft');
    expect(input().value).toBe('Keep my draft');
    const pending = admission();
    await send();
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(input().value).toBe('');
    await act(async () => pending.resolve());
    expect(mocks.get).not.toHaveBeenCalledWith('/api/v1/projects/alpha');
  });

  it('refreshes a slash-command Project only while its accepted completion is current', async () => {
    const pending = admission();
    mocks.get.mockResolvedValueOnce(project('alpha', 'Refreshed project'));
    await draft('/status');
    await send();
    expect(input().value).toBe('');
    await act(async () => pending.resolve());
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/projects/alpha');
    expect(container.textContent).toContain('Refreshed project');
  });

  it('does not start an old slash-command refresh after switching Project', async () => {
    const pending = admission();
    await draft('/status');
    await send();
    await switchToBeta();
    await act(async () => pending.resolve());
    expect(mocks.get).not.toHaveBeenCalledWith('/api/v1/projects/alpha');
    expect(container.textContent).toContain('Project beta');
  });

  it('does not publish a delayed slash-command refresh after switching Project', async () => {
    const pending = admission();
    const refresh = deferred<ProjectDesktopRecord>();
    mocks.get.mockReturnValueOnce(refresh.promise);
    await draft('/status');
    await send();
    await act(async () => pending.resolve());
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/projects/alpha');
    await switchToBeta();
    await act(async () => refresh.resolve(project('alpha', 'Stale refresh must not appear')));
    expect(container.textContent).toContain('Project beta');
    expect(container.textContent).not.toContain('Stale refresh must not appear');
    expect(mocks.sessionId).toBe('bound-beta');
  });

  it('keeps the existing IDE conversation and draft when Change Project is canceled', async () => {
    const pending = deferred<{ canceled: true }>();
    mocks.picker.mockReturnValueOnce(pending.promise);
    await draft('Existing draft');
    const bindingsBefore = mocks.bind.mock.calls.length;
    await changeProject();
    await act(async () => pending.resolve({ canceled: true }));
    expect(mocks.sessionId).toBe('bound-alpha');
    expect(input().value).toBe('Existing draft');
    expect(container.textContent).toContain('Existing conversation');
    expect(container.textContent).toContain('Project alpha');
    expect(mocks.bind).toHaveBeenCalledTimes(bindingsBefore);
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
