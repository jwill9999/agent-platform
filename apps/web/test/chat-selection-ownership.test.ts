// @vitest-environment jsdom
import React, { act, createElement, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Agent, ProjectDesktopRecord, SessionRecord } from '@agent-platform/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '../app/page';
import type { Chat } from '../components/chat/chat';
import type { SessionDropdown } from '../components/chat/session-dropdown';
import {
  workspaceHomeRequestedEvent,
  workspacePersonalChatRequestedEvent,
} from '../lib/project-navigation';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  picker: vi.fn(),
  createProject: vi.fn(),
  bind: vi.fn(),
  recent: vi.fn(),
  refresh: vi.fn(),
  sessions: [] as SessionRecord[],
}));
vi.mock('../lib/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/apiClient')>()),
  apiGet: mocks.get,
  apiPost: mocks.post,
  apiPut: mocks.put,
}));
vi.mock('../lib/desktop-projects', () => ({
  hasDesktopProjectBridge: () => true,
  hasDesktopProjectIdeBridge: () => false,
  selectAndRegisterDesktopProject: mocks.picker,
  createAndRegisterDesktopProject: mocks.createProject,
  bindProjectSession: mocks.bind,
  loadRecentDesktopProjects: mocks.recent,
  openDesktopProjectIde: vi.fn(),
}));
vi.mock('../hooks/use-sessions', () => ({
  useSessions: () => ({ sessions: mocks.sessions, loading: false, refresh: mocks.refresh }),
}));
// Keep the actual page and chat hook mounted. These presentation-only probes expose the
// selected conversation and invoke the same dropdown callbacks as the production children.
vi.mock('../components/chat/chat', () => ({
  Chat: (props: ComponentProps<typeof Chat>) =>
    createElement('output', { 'data-testid': 'conversation' }, props.diagnosticSessionId ?? ''),
}));
vi.mock('../components/chat/agent-model-context', () => ({
  AgentModelProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../components/chat/session-dropdown', () => ({
  SessionDropdown: (props: ComponentProps<typeof SessionDropdown>) =>
    createElement(
      'nav',
      null,
      ...props.sessions.map((session) =>
        createElement(
          'button',
          { key: session.id, onClick: () => props.onSelectSession(session) },
          `Select ${session.id}`,
        ),
      ),
      createElement(
        'button',
        { onClick: () => props.onNewChatForAgent(props.selectedAgentId ?? 'personal') },
        'New conversation',
      ),
    ),
}));
vi.mock('../components/ui/dialog', () => {
  const content = ({ children }: { children: ReactNode }) => createElement('div', null, children);
  return {
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? content({ children }) : null,
    DialogContent: content,
    DialogDescription: content,
    DialogHeader: content,
    DialogTitle: content,
  };
});
vi.mock('../components/project/project-instructions-review', () => ({
  ProjectInstructionsApprovalNotice: () => null,
  ProjectInstructionsRejectedNotice: () => null,
  ProjectInstructionsReview: () => null,
}));
vi.mock('../components/project/project-branch-selector', () => ({
  ProjectBranchSelector: () => null,
}));
vi.mock('../components/project/project-evidence-rail', () => ({ ProjectEvidenceRail: () => null }));
vi.mock('../components/project/project-terminal-dock', () => ({ ProjectTerminalDock: () => null }));
vi.mock('../components/project/project-webview-panel', () => ({ ProjectWebViewPanel: () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function session(id: string, agentId = 'personal', projectId?: string): SessionRecord {
  return {
    id,
    agentId,
    mode: projectId ? 'project' : 'chat',
    projectId,
    title: id,
    createdAtMs: 1,
    updatedAtMs: 1,
  };
}
function project(id: string): ProjectDesktopRecord {
  return {
    id,
    slug: id,
    name: `Project ${id}`,
    workspacePath: `/fixture/${id}`,
    createdAtMs: 1,
    updatedAtMs: 1,
    metadata: {
      source: 'desktop',
      folderName: id,
      capabilityState: 'backend_accessible',
      onboardingState: 'missing',
      defaultAgentProfile: 'coding',
      instructionFileCount: 0,
      workspaceProfile: 'coding_project',
      workspaceCapabilities: [],
    },
  };
}
const agents: Agent[] = [
  ['personal', 'default-agent'],
  ['coding', 'coding'],
].map(([id, slug]) => ({
  id: id!,
  slug: slug!,
  name: id!,
  systemPrompt: 'Test',
  allowedSkillIds: [],
  allowedToolIds: [],
  allowedMcpServerIds: [],
  executionLimits: { maxSteps: 1, maxParallelTasks: 1, timeoutMs: 1000 },
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  window.history.replaceState(null, '', '/');
  mocks.sessions = [session('A'), session('B'), session('legacy', 'coding')];
  mocks.refresh.mockResolvedValue(undefined);
  mocks.get.mockImplementation(async (path: string) => {
    if (path === '/api/v1/agents') return agents;
    if (path === '/api/v1/model-configs' || path === '/api/v1/sessions') return [];
    if (path.endsWith('/sensors')) return null;
    throw new Error(`Unexpected fixture GET ${path}`);
  });
  mocks.post.mockImplementation(async (path: string) => {
    if (path === '/api/v1/sessions') return session('personal-current');
    const match = /^\/api\/v1\/projects\/([^/]+)\/refresh$/.exec(path);
    if (match?.[1]) return project(match[1]);
    throw new Error(`Unexpected fixture POST ${path}`);
  });
  mocks.put.mockImplementation(async (_path: string, body: unknown) => body);
  mocks.recent.mockResolvedValue([]);
  mocks.bind.mockImplementation(async ({ projectId }: { projectId: string }) => ({
    session: session(`bound-${projectId}`, 'coding', projectId),
    created: true,
  }));
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (input: string) =>
        new Response(
          JSON.stringify(input === '/api/health/ready' ? { checks: {} } : { data: [] }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
    ),
  );
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(HomePage)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!button) throw new Error(`Missing button ${label}: ${container.textContent}`);
  await act(async () => button.click());
}
async function navigate(event: string) {
  await act(async () => window.dispatchEvent(new Event(event)));
}
function current() {
  return container.querySelector('[data-testid="conversation"]')?.textContent;
}
async function settle<T>(pending: ReturnType<typeof deferred<T>>, value: T) {
  await act(async () => pending.resolve(value));
}
async function openPersonal() {
  await navigate(workspacePersonalChatRequestedEvent);
  expect(current()).toBe('personal-current');
}
async function openProject(id = 'alpha') {
  mocks.picker.mockResolvedValueOnce({ project: project(id), created: false });
  await click('Open folder');
  expect(current()).toBe(`bound-${id}`);
}

describe('HomePage asynchronous selection ownership', () => {
  it('stays on Home without creating or binding a session when its current picker is canceled', async () => {
    const pending = deferred<null>();
    mocks.picker.mockReturnValueOnce(pending.promise);
    await click('Open folder');
    await settle(pending, null);
    expect(current()).toBeUndefined();
    expect(container.textContent).toContain('Choose a workspace');
    expect(mocks.bind).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe('/');
  });

  it('does not publish a folder selected after navigation to a personal conversation', async () => {
    const pending = deferred<{ project: ProjectDesktopRecord; created: boolean }>();
    mocks.picker.mockReturnValueOnce(pending.promise);
    await click('Open folder');
    await openPersonal();
    await settle(pending, { project: project('late'), created: false });
    expect(current()).toBe('personal-current');
    expect(mocks.bind).not.toHaveBeenCalled();
    expect(window.location.search).not.toContain('late');
  });

  it('preserves the current conversation when a superseded folder picker is canceled', async () => {
    const pending = deferred<null>();
    mocks.picker.mockReturnValueOnce(pending.promise);
    await click('Open folder');
    await openPersonal();
    await click('Select B');
    await settle(pending, null);
    expect(current()).toBe('B');
    expect(mocks.bind).not.toHaveBeenCalled();
  });

  it('does not reopen a Project when its delayed binding finishes after returning Home', async () => {
    const pending = deferred<{ session: SessionRecord; created: boolean }>();
    mocks.picker.mockResolvedValueOnce({ project: project('alpha'), created: false });
    mocks.bind.mockReturnValueOnce(pending.promise);
    await click('Open folder');
    expect(mocks.bind).toHaveBeenCalledOnce();
    await navigate(workspaceHomeRequestedEvent);
    await settle(pending, { session: session('late-binding', 'coding', 'alpha'), created: true });
    expect(current()).toBeUndefined();
    expect(container.textContent).toContain('Choose a workspace');
    expect(mocks.get).not.toHaveBeenCalledWith('/api/v1/sessions/late-binding/sensors');
  });

  it('rejects a stale normalization response even when the same saved session is selected again', async () => {
    await openPersonal();
    const first = deferred<SessionRecord>();
    const second = deferred<SessionRecord>();
    mocks.put.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await click('Select legacy');
    await click('Select B');
    expect(current()).toBe('B');
    await click('Select legacy');
    expect(current()).toBe('');
    await settle(first, session('legacy'));
    expect(current()).toBe('');
    expect(mocks.refresh).not.toHaveBeenCalled();
    mocks.refresh.mockImplementation(async () => {
      mocks.sessions = mocks.sessions.map((value) =>
        value.id === 'legacy' ? session('legacy') : value,
      );
    });
    await settle(second, session('legacy'));
    expect(current()).toBe('legacy');
    expect(mocks.put).toHaveBeenCalledTimes(2);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('ignores a failed old normalization after selecting another saved conversation', async () => {
    await openPersonal();
    const pending = deferred<SessionRecord>();
    mocks.put.mockReturnValueOnce(pending.promise);
    await click('Select legacy');
    await click('Select B');
    await act(async () => pending.reject(new Error('old selection failed')));
    expect(current()).toBe('B');
    expect(container.textContent).not.toContain('Failed to open chat session');
  });

  it.each(['personal', 'project'] as const)(
    'does not publish a delayed new %s session after returning Home',
    async (mode) => {
      if (mode === 'personal') await openPersonal();
      else await openProject();
      const pending = deferred<SessionRecord>();
      mocks.post.mockReturnValueOnce(pending.promise);
      await click('New conversation');
      await navigate(workspaceHomeRequestedEvent);
      await settle(
        pending,
        session(
          'late-created',
          mode === 'personal' ? 'personal' : 'coding',
          mode === 'project' ? 'alpha' : undefined,
        ),
      );
      expect(current()).toBeUndefined();
      expect(container.textContent).toContain('Choose a workspace');
      expect(mocks.refresh).not.toHaveBeenCalled();
      expect(mocks.get).not.toHaveBeenCalledWith('/api/v1/sessions/late-created/sensors');
    },
  );

  it('does not publish a created Project after navigating to a different conversation', async () => {
    const pending = deferred<{ project: ProjectDesktopRecord; created: boolean }>();
    mocks.createProject.mockReturnValueOnce(pending.promise);
    await click('New project');
    const start = [...container.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Start from scratch'),
    )!;
    await act(async () => start.click());
    const input = container.querySelector<HTMLInputElement>('#new-project-name')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        'Late project',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    expect(mocks.createProject).toHaveBeenCalledWith({ name: 'Late project' });
    await openPersonal();
    await settle(pending, { project: project('late-created'), created: true });
    expect(current()).toBe('personal-current');
    expect(mocks.bind).not.toHaveBeenCalled();
  });
});
