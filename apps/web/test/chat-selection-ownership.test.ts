// @vitest-environment jsdom
import React, { act, createElement, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Agent, ProjectDesktopRecord, SessionRecord } from '@agent-platform/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '../app/page';
import { Sidebar } from '../components/layout/sidebar';
import { SidebarProvider } from '../components/layout/sidebar-context';
import type { Chat } from '../components/chat/chat';
import type { SessionDropdown } from '../components/chat/session-dropdown';
import {
  workspaceHomeRequestedEvent,
  workspacePersonalChatRequestedEvent,
  projectReopenRequestedEvent,
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
  linkFallback: vi.fn(),
  sessions: [] as SessionRecord[],
}));
// The real Sidebar dispatches before Next Link commits its route. Keep that default
// navigation deferred so the previous URL remains observable until the test commits it.
vi.mock('next/link', () => ({
  default: ({ href, onClick, ...props }: ComponentProps<'a'>) =>
    createElement('a', {
      ...props,
      href,
      onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          mocks.linkFallback(href);
          event.preventDefault();
        }
      },
    }),
}));
vi.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }));
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
    createElement(
      'div',
      {
        'data-testid': 'chat-presentation',
        'data-project': props.workspaceWebViewProjectId ?? 'none',
      },
      createElement('output', { 'data-testid': 'conversation' }, props.diagnosticSessionId ?? ''),
      createElement('input', { 'data-testid': 'draft', defaultValue: '' }),
      props.sideAccessory,
    ),
}));
vi.mock('../components/chat/agent-model-context', () => ({
  AgentModelProvider: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: {
      onSelectAgent: (agentId: string) => void;
      selectedAgentId: string | null;
      selectedModelConfigId: string | null;
    };
  }) =>
    createElement(
      'div',
      {
        'data-testid': 'agent-model-selection',
        'data-agent': value.selectedAgentId,
        'data-model': value.selectedModelConfigId,
      },
      children,
      createElement(
        'button',
        { onClick: () => value.onSelectAgent('personal') },
        'Choose Personal agent',
      ),
      createElement(
        'button',
        { onClick: () => value.onSelectAgent('coding') },
        'Choose Coding agent',
      ),
    ),
}));
vi.mock('../components/chat/session-dropdown', () => ({
  SessionDropdown: (props: ComponentProps<typeof SessionDropdown>) =>
    createElement(
      'nav',
      { 'data-testid': 'session-scope', 'data-label': props.scopeLabel },
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
vi.mock('../components/project/project-activity-panel', () => ({
  ProjectActivityPanel: () => createElement('aside', null, 'Activity content'),
}));
vi.mock('../components/project/project-git-github-panel', () => ({
  ProjectGitHubPanel: () =>
    createElement('aside', { 'aria-label': 'Git and GitHub' }, 'Git content'),
}));
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
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: true }));
  window.history.replaceState(null, '', '/');
  mocks.sessions = [session('A'), session('B'), session('legacy', 'coding')];
  mocks.refresh.mockResolvedValue(undefined);
  mocks.get.mockImplementation(async (path: string) => {
    if (path === '/api/v1/agents') return agents;
    if (path === '/api/v1/model-configs' || path === '/api/v1/sessions') return [];
    if (path === '/api/v1/projects/desktop/recent') return { projects: [project('alpha')] };
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

async function mountNavigationShell() {
  const get = mocks.get.getMockImplementation()!;
  mocks.get.mockImplementation(async (path: string) => {
    if (path === '/api/v1/agents')
      return agents.map((agent) => ({ ...agent, modelConfigId: `${agent.id}-model` }));
    if (path === '/api/v1/model-configs')
      return ['personal', 'coding'].map((id) => ({
        id: `${id}-model`,
        name: id,
        provider: 'openai',
        model: `fixture-${id}`,
        hasApiKey: true,
        createdAtMs: 1,
        updatedAtMs: 1,
      }));
    return get(path);
  });
  await act(async () =>
    root.render(
      createElement(SidebarProvider, null, createElement(Sidebar), createElement(HomePage)),
    ),
  );
}

async function clickSidebarLink(href: string, init: MouseEventInit = {}) {
  const link = container.querySelector<HTMLAnchorElement>(`aside a[href="${href}"]`);
  if (!link) throw new Error(`Missing Sidebar link ${href}`);
  await act(async () =>
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init })),
  );
}

function expectPersonalScope(expectedSession = 'personal-current') {
  expect(container.querySelector('[data-workspace-surface="chat"]')).not.toBeNull();
  expect(container.querySelector('[data-workspace-scope="global-chat"]')).not.toBeNull();
  expect(container.querySelector('[data-workspace-surface="project-chat"]')).toBeNull();
  expect(container.querySelector('[data-testid="session-scope"]')?.getAttribute('data-label')).toBe(
    'Personal chat sessions',
  );
  expect(container.querySelector('[data-testid="session-scope"]')?.textContent).toContain(
    'Select A',
  );
  expect(container.querySelector('[data-testid="session-scope"]')?.textContent).not.toContain(
    'Select project-alpha',
  );
  expect(
    container.querySelector('[data-testid="agent-model-selection"]')?.getAttribute('data-agent'),
  ).toBe('personal');
  expect(
    container.querySelector('[data-testid="agent-model-selection"]')?.getAttribute('data-model'),
  ).toBe('personal-model');
  expect(
    container.querySelector('[data-testid="chat-presentation"]')?.getAttribute('data-project'),
  ).toBe('none');
  expect(current()).toBe(expectedSession);
}

async function requestProject(id: string) {
  await act(async () =>
    window.dispatchEvent(
      new CustomEvent(projectReopenRequestedEvent, { detail: { projectId: id } }),
    ),
  );
}

async function traverseHistory(direction: 'back' | 'forward') {
  await act(async () => {
    const changed = new Promise<void>((resolve) =>
      window.addEventListener('popstate', () => resolve(), { once: true }),
    );
    window.history[direction]();
    await changed;
  });
}

async function coldProjectReopen() {
  await act(async () => root.unmount());
  vi.clearAllMocks();
  const agentList = deferred<Agent[]>();
  const sessionList = deferred<SessionRecord[]>();
  mocks.get.mockImplementation(async (path: string) => {
    if (path === '/api/v1/agents') return agentList.promise;
    if (path === '/api/v1/model-configs') return [];
    if (path === '/api/v1/sessions') return sessionList.promise;
    if (path.endsWith('/sensors')) return null;
    throw new Error(`Unexpected cold fixture GET ${path}`);
  });
  mocks.recent.mockResolvedValue([project('alpha')]);
  window.history.replaceState(null, '', '/?projectId=alpha');
  root = createRoot(container);
  await act(async () => root.render(createElement(HomePage)));
  return { agentList, sessionList };
}

describe('HomePage asynchronous selection ownership', () => {
  it('keeps personal scope authoritative when a Sidebar click precedes the deferred Next URL commit', async () => {
    mocks.sessions.push(session('project-alpha', 'coding', 'alpha'));
    await mountNavigationShell();
    await openProject('alpha');
    expect(window.location.search).toBe('?projectId=alpha');
    const staleProject = deferred<ProjectDesktopRecord[]>();
    mocks.recent.mockReturnValueOnce(staleProject.promise);
    const bindsBeforePersonal = mocks.bind.mock.calls.length;
    const historyBeforePersonal = window.history.length;

    await clickSidebarLink('/?mode=chat');
    await settle(staleProject, [project('alpha')]);

    expectPersonalScope();
    expect(window.location.search).toBe('?mode=chat');
    expect(window.history).toHaveLength(historyBeforePersonal + 1);
    expect(mocks.bind).toHaveBeenCalledTimes(bindsBeforePersonal);
    expect(mocks.linkFallback).not.toHaveBeenCalled();
  });

  it('aligns an already committed personal URL without adding another history entry', async () => {
    mocks.sessions.push(session('project-alpha', 'coding', 'alpha'));
    await mountNavigationShell();
    await openProject();
    window.history.pushState(null, '', '/?mode=chat');
    const length = window.history.length;
    await navigate(workspacePersonalChatRequestedEvent);
    expectPersonalScope();
    expect(window.history).toHaveLength(length);
    expect(mocks.bind).toHaveBeenCalledOnce();
  });

  it('keeps a resumed personal conversation when newer personal intent supersedes a pending Project lookup', async () => {
    mocks.sessions.push(session('project-alpha', 'coding', 'alpha'));
    await mountNavigationShell();
    await openPersonal();
    await click('Select B');
    const pending = deferred<ProjectDesktopRecord[]>();
    mocks.recent.mockReturnValueOnce(pending.promise);
    await requestProject('alpha');
    await clickSidebarLink('/?mode=chat');
    await settle(pending, [project('alpha')]);
    expectPersonalScope('B');
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(mocks.bind).not.toHaveBeenCalled();
  });

  it('keeps the newest Project intent after personal navigation abandons an older Project lookup', async () => {
    await mountNavigationShell();
    await openPersonal();
    const pending = deferred<ProjectDesktopRecord[]>();
    mocks.recent.mockReturnValueOnce(pending.promise).mockResolvedValueOnce([project('beta')]);
    await requestProject('alpha');
    await clickSidebarLink('/?mode=chat');
    await requestProject('beta');
    await settle(pending, [project('alpha')]);
    expect(current()).toBe('bound-beta');
    expect(container.querySelector('[data-workspace-surface="project-chat"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="session-scope"]')?.getAttribute('data-label'),
    ).toBe('Project beta sessions');
    expect(
      container.querySelector('[data-testid="chat-presentation"]')?.getAttribute('data-project'),
    ).toBe('beta');
    expect(mocks.bind).toHaveBeenCalledOnce();
    expect(mocks.bind.mock.calls[0]?.[0].projectId).toBe('beta');
  });

  it.each([
    { label: 'control', init: { ctrlKey: true } },
    { label: 'meta', init: { metaKey: true } },
    { label: 'shift', init: { shiftKey: true } },
    { label: 'alt', init: { altKey: true } },
    { label: 'middle button', init: { button: 1 } },
    { label: 'new tab', attribute: 'target', value: '_blank', init: {} },
    { label: 'download', attribute: 'download', value: 'fixture', init: {} },
  ])(
    'leaves $label links to normal navigation without changing this window scope',
    async ({ init, attribute, value }) => {
      await mountNavigationShell();
      await openProject();
      const link = container.querySelector<HTMLAnchorElement>('aside a[href="/?mode=chat"]')!;
      if (attribute) link.setAttribute(attribute, value!);
      const length = window.history.length;
      const postsBeforeLink = mocks.post.mock.calls.length;
      await clickSidebarLink('/?mode=chat', init);
      expect(current()).toBe('bound-alpha');
      expect(window.location.search).toBe('?projectId=alpha');
      expect(window.history).toHaveLength(length);
      expect(mocks.linkFallback).toHaveBeenCalledOnce();
      expect(mocks.post).toHaveBeenCalledTimes(postsBeforeLink);
    },
  );

  it('does not dispatch another scope request for an already prevented link', async () => {
    await mountNavigationShell();
    await openProject();
    const link = container.querySelector<HTMLAnchorElement>('aside a[href="/?mode=chat"]')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const postsBeforeLink = mocks.post.mock.calls.length;
    event.preventDefault();
    await act(async () => link.dispatchEvent(event));
    expect(current()).toBe('bound-alpha');
    expect(window.location.search).toBe('?projectId=alpha');
    expect(mocks.linkFallback).not.toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledTimes(postsBeforeLink);
  });

  it.each(['/', '/settings/models'])(
    'uses Next Link fallback from %s when HomePage has no mounted listener',
    async (pathname) => {
      window.history.replaceState(null, '', pathname);
      await act(async () =>
        root.render(createElement(SidebarProvider, null, createElement(Sidebar))),
      );
      const length = window.history.length;
      await clickSidebarLink('/?mode=chat');
      expect(window.location.pathname).toBe(pathname);
      expect(window.location.search).toBe('');
      expect(window.history).toHaveLength(length);
      expect(mocks.linkFallback).toHaveBeenCalledExactlyOnceWith('/?mode=chat');
      expect(mocks.post).not.toHaveBeenCalled();
    },
  );

  it('retains normal Settings-to-root navigation even before an old HomePage listener unmounts', async () => {
    await mountNavigationShell();
    window.history.replaceState(null, '', '/settings/models');
    const length = window.history.length;
    await clickSidebarLink('/?mode=chat');
    expect(window.location.pathname).toBe('/settings/models');
    expect(window.history).toHaveLength(length);
    expect(current()).toBeUndefined();
    expect(mocks.linkFallback).toHaveBeenCalledExactlyOnceWith('/?mode=chat');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([
    { pathname: '/settings/models', scope: 'personal' },
    { pathname: '/settings/models', scope: 'Project' },
    { pathname: '/', scope: 'personal' },
    { pathname: '/', scope: 'Project' },
  ])(
    'synchronizes a persistent Sidebar after $pathname fallback commits the $scope URL and mounts HomePage',
    async ({ pathname, scope }) => {
      window.history.replaceState(null, '', pathname);
      await act(async () =>
        root.render(createElement(SidebarProvider, null, createElement(Sidebar))),
      );
      const sidebar = container.querySelector('aside');
      const href = scope === 'personal' ? '/?mode=chat' : '/?projectId=alpha';
      if (scope === 'personal') await clickSidebarLink(href);
      else {
        const projectLink = container.querySelector<HTMLAnchorElement>(
          'aside a[href="/?projectId=alpha"]',
        )!;
        await act(async () =>
          projectLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
        );
      }
      expect(mocks.linkFallback).toHaveBeenCalledExactlyOnceWith(href);

      // Complete the deferred normal Next navigation. AppShell retains its Sidebar;
      // only the route child changes, and pushState does not emit popstate.
      window.history.pushState(null, '', href);
      mocks.recent.mockResolvedValue([project('alpha')]);
      await mountNavigationShell();

      expect(container.querySelector('aside')).toBe(sidebar);
      if (scope === 'personal') {
        expectPersonalScope();
        expect(
          container.querySelector('aside a[href="/?mode=chat"]')?.getAttribute('aria-current'),
        ).toBe('page');
        expect(container.querySelector('section[aria-label="Recent Projects"]')).toBeNull();
      } else {
        expect(current()).toBe('bound-alpha');
        expect(container.querySelector('[data-workspace-surface="project-chat"]')).not.toBeNull();
        expect(
          container.querySelector('aside a[href="/?mode=chat"]')?.getAttribute('aria-current'),
        ).toBeNull();
        expect(container.querySelector('section[aria-label="Recent Projects"]')).not.toBeNull();
      }
      expect(container.querySelector('aside a[href="/"]')?.getAttribute('aria-current')).toBeNull();
    },
  );

  it.each(['/settings/sessions', 'https://outside.example/?mode=chat'])(
    'leaves a link targeting %s to normal navigation',
    async (destination) => {
      await mountNavigationShell();
      await openProject();
      const link = container.querySelector<HTMLAnchorElement>('aside a[href="/?mode=chat"]')!;
      link.href = destination;
      const length = window.history.length;
      const postsBeforeLink = mocks.post.mock.calls.length;
      await act(async () =>
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
      );
      expect(window.location.search).toBe('?projectId=alpha');
      expect(window.history).toHaveLength(length);
      expect(current()).toBe('bound-alpha');
      expect(mocks.linkFallback).toHaveBeenCalledOnce();
      expect(mocks.post).toHaveBeenCalledTimes(postsBeforeLink);
    },
  );

  it('replays browser Back and Forward through personal, Project and Home scopes without pushing history', async () => {
    mocks.sessions.push(session('project-alpha', 'coding', 'alpha'));
    await mountNavigationShell();
    await clickSidebarLink('/?mode=chat');
    await requestProject('alpha');
    mocks.recent.mockResolvedValue([project('alpha')]);
    await clickSidebarLink('/');
    const length = window.history.length;
    const pushes = vi.spyOn(window.history, 'pushState');
    try {
      await traverseHistory('back');
      expect(window.location.search).toBe('?projectId=alpha');
      expect(container.querySelector('[data-workspace-surface="project-chat"]')).not.toBeNull();
      await traverseHistory('back');
      expect(window.location.search).toBe('?mode=chat');
      expectPersonalScope();
      await traverseHistory('forward');
      expect(window.location.search).toBe('?projectId=alpha');
      expect(container.querySelector('[data-workspace-surface="project-chat"]')).not.toBeNull();
      await traverseHistory('forward');
      expect(window.location.search).toBe('');
      expect(container.textContent).toContain('Choose a workspace');
      expect(pushes).not.toHaveBeenCalled();
      expect(window.history).toHaveLength(length);
    } finally {
      pushes.mockRestore();
    }
  });

  it('refreshes retained session visibility on Project reopen and revokes the old navigation guard', async () => {
    await openProject('alpha');
    expect(mocks.refresh).toHaveBeenCalledOnce();
    const firstGuard = mocks.refresh.mock.calls[0]?.[0] as () => boolean;
    expect(firstGuard()).toBe(true);
    await navigate(workspaceHomeRequestedEvent);
    expect(firstGuard()).toBe(false);
    await openProject('alpha');
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    const currentGuard = mocks.refresh.mock.calls[1]?.[0] as () => boolean;
    expect(currentGuard()).toBe(true);
    expect(firstGuard()).toBe(false);
    expect(current()).toBe('bound-alpha');
  });

  it('preserves Git selection through delayed project binding while resetting session-owned chat', async () => {
    const pending = deferred<{ session: SessionRecord; created: boolean }>();
    mocks.picker.mockResolvedValueOnce({ project: project('alpha'), created: false });
    mocks.bind.mockReturnValueOnce(pending.promise);
    await click('Open folder');
    expect(current()).toBe('');
    await click('Git & GitHub');
    const before = container.querySelector<HTMLInputElement>('[data-testid="draft"]')!;
    before.value = 'old session draft';
    await settle(pending, { session: session('canonical', 'coding', 'alpha'), created: true });
    expect(current()).toBe('canonical');
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
      'Git & GitHub',
    );
    expect(container.querySelector('[aria-label="Git and GitHub"]')?.textContent).toBe(
      'Git content',
    );
    const after = container.querySelector<HTMLInputElement>('[data-testid="draft"]')!;
    expect(after).not.toBe(before);
    expect(after.value).toBe('');
  });

  it('keeps the selected Git view when switching sessions within the same project', async () => {
    mocks.sessions.push(session('alternate', 'coding', 'alpha'));
    await openProject();
    await click('Git & GitHub');
    await click('Select alternate');
    expect(current()).toBe('alternate');
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
      'Git & GitHub',
    );
    expect(container.querySelector('[aria-label="Git and GitHub"]')).not.toBeNull();
  });

  it('retains Git through hide/show but resets to Activity after leaving the project', async () => {
    await openProject();
    await click('Git & GitHub');
    const toggle = () =>
      container.querySelector<HTMLButtonElement>('[aria-controls="project-evidence-rail"]')!;
    await act(async () => toggle().click());
    expect(container.querySelector('#project-evidence-rail')).toBeNull();
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Show activity and Git panel"]')!
        .click(),
    );
    expect(container.querySelector('[aria-label="Git and GitHub"]')).not.toBeNull();
    await navigate(workspaceHomeRequestedEvent);
    await openProject('beta');
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
      'Activity',
    );
    await click('Git & GitHub');
    await navigate(workspaceHomeRequestedEvent);
    await openProject('alpha');
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
      'Activity',
    );
  });

  it('keeps a usable personal conversation when the current personal navigation is requested again', async () => {
    await openPersonal();
    await navigate(workspacePersonalChatRequestedEvent);
    expect(current()).toBe('personal-current');
    expect(mocks.post).toHaveBeenCalledOnce();
    mocks.post.mockResolvedValueOnce(session('explicit-new'));
    await click('New conversation');
    expect(current()).toBe('explicit-new');
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

  it('preserves a resumed conversation when personal workspace navigation is repeated', async () => {
    await openPersonal();
    await click('Select B');
    expect(current()).toBe('B');
    await navigate(workspacePersonalChatRequestedEvent);
    expect(current()).toBe('B');
    expect(mocks.post).toHaveBeenCalledOnce();
  });

  it('preserves an in-flight personal session creation when personal navigation is repeated', async () => {
    const pending = deferred<SessionRecord>();
    mocks.post.mockReturnValueOnce(pending.promise);
    await navigate(workspacePersonalChatRequestedEvent);
    expect(current()).toBe('');
    await navigate(workspacePersonalChatRequestedEvent);
    await settle(pending, session('pending-personal'));
    expect(current()).toBe('pending-personal');
    expect(mocks.post).toHaveBeenCalledOnce();
  });

  it('creates personal chat after Project agent switches even while all old bindings are pending', async () => {
    const first = deferred<{ session: SessionRecord; created: boolean }>();
    const second = deferred<{ session: SessionRecord; created: boolean }>();
    const third = deferred<{ session: SessionRecord; created: boolean }>();
    mocks.bind
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise);
    mocks.createProject.mockResolvedValueOnce({ project: project('alpha'), created: true });
    await click('New project');
    const start = [...container.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Start from scratch'),
    )!;
    await act(async () => start.click());
    const input = container.querySelector<HTMLInputElement>('#new-project-name')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        'alpha',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    await click('Choose Personal agent');
    await click('Choose Coding agent');
    expect(mocks.bind).toHaveBeenCalledTimes(3);
    await navigate(workspaceHomeRequestedEvent);
    const chat = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.startsWith('Chat'),
    )!;
    await act(async () => chat.click());
    expect(current()).toBe('personal-current');
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/sessions', {
      agentId: 'personal',
      mode: 'chat',
    });
    for (const pending of [first, second, third]) {
      await settle(pending, { session: session('old-project', 'coding', 'alpha'), created: false });
    }
    expect(current()).toBe('personal-current');
  });

  it('binds once after agents arrive during a cold Project session lookup', async () => {
    const pending = await coldProjectReopen();
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/sessions');
    expect(current()).toBe('');
    await settle(pending.agentList, agents);
    expect(mocks.bind).not.toHaveBeenCalled();
    await settle(pending.sessionList, []);
    expect(current()).toBe('bound-alpha');
    expect(mocks.bind).toHaveBeenCalledOnce();
    expect(mocks.bind).toHaveBeenCalledWith({ agentId: 'coding', projectId: 'alpha' });
  });

  it('binds once when agents arrive after the cold Project lookup is complete', async () => {
    const pending = await coldProjectReopen();
    await settle(pending.sessionList, []);
    expect(mocks.bind).not.toHaveBeenCalled();
    await settle(pending.agentList, agents);
    expect(current()).toBe('bound-alpha');
    expect(mocks.bind).toHaveBeenCalledOnce();
    expect(mocks.bind).toHaveBeenCalledWith({ agentId: 'coding', projectId: 'alpha' });
  });

  it('surfaces a failed deferred binding without automatically retrying it', async () => {
    const pending = await coldProjectReopen();
    mocks.bind.mockRejectedValue(new Error('controlled binding failure'));
    await settle(pending.agentList, agents);
    await settle(pending.sessionList, []);
    expect(current()).toBe('');
    expect(container.textContent).toContain('Failed to open Project chat');
    expect(mocks.bind).toHaveBeenCalledOnce();
  });

  it('restores an existing saved Project session without deferred binding or agent substitution', async () => {
    const pending = await coldProjectReopen();
    await settle(pending.agentList, agents);
    await settle(pending.sessionList, [session('saved-project', 'saved-custom-agent', 'alpha')]);
    expect(current()).toBe('saved-project');
    expect(mocks.bind).not.toHaveBeenCalled();
  });

  it('invalidates an already queued cold Project binding when navigation selects personal chat', async () => {
    const pending = await coldProjectReopen();
    await settle(pending.sessionList, []);
    await navigate(workspacePersonalChatRequestedEvent);
    await settle(pending.agentList, agents);
    expect(current()).toBe('personal-current');
    expect(mocks.bind).not.toHaveBeenCalled();
  });

  it('does not bind an abandoned cold Project after late agents and session lookup finish', async () => {
    const pending = await coldProjectReopen();
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/sessions');
    await navigate(workspaceHomeRequestedEvent);
    await settle(pending.agentList, agents);
    await settle(pending.sessionList, []);
    expect(current()).toBeUndefined();
    expect(container.textContent).toContain('Choose a workspace');
    expect(mocks.bind).not.toHaveBeenCalled();
  });

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
      else {
        await openProject();
        expect(mocks.refresh).toHaveBeenCalledOnce();
        // Navigation refresh is legitimate; only the abandoned creation below
        // must not publish another refresh after its owner returned Home.
        mocks.refresh.mockClear();
      }
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
