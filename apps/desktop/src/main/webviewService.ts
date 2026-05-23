import type {
  DesktopWebViewPolicyTier,
  DesktopWebViewState,
  DesktopWebViewStatus,
  DesktopWorkspaceOpenResult,
} from '@agent-platform/contracts';
import type {
  BrowserWindow,
  Event,
  Rectangle,
  WebContents,
  WebContentsView,
  WebPreferences,
} from 'electron';
import { randomUUID } from 'node:crypto';

export interface DesktopWebViewBoundsRequest {
  readonly webviewId: string;
  readonly bounds: Rectangle;
}

export interface DesktopWebViewIdRequest {
  readonly webviewId: string;
}

export interface DesktopWebViewCreateRequest {
  readonly url: string;
  readonly projectId?: string;
}

export interface DesktopWebViewPolicy {
  readonly allowed: boolean;
  readonly tier?: DesktopWebViewPolicyTier;
  readonly origin?: string;
  readonly normalizedUrl?: string;
  readonly reason?: string;
  readonly externalFallbackUrl?: string;
}

interface DesktopWebViewSession {
  readonly createdAt: string;
  readonly projectId?: string;
  readonly view: DesktopWebViewView;
  readonly webviewId: string;
  policyTier: DesktopWebViewPolicyTier;
  status: DesktopWebViewStatus;
  title?: string;
  url: string;
  origin: string;
  externalFallbackUrl?: string;
  blockedUrl?: string;
  error?: string;
  updatedAt: string;
}

export interface DesktopWebViewView {
  readonly webContents: Pick<
    WebContents,
    | 'canGoBack'
    | 'canGoForward'
    | 'goBack'
    | 'goForward'
    | 'loadURL'
    | 'on'
    | 'reload'
    | 'setWindowOpenHandler'
    | 'stop'
    | 'getTitle'
    | 'session'
  > & {
    readonly close?: (options?: { waitForBeforeUnload?: boolean }) => void;
    readonly isDestroyed?: () => boolean;
    readonly destroy?: () => void;
  };
  readonly setBounds: (bounds: Rectangle) => void;
  readonly setVisible: (visible: boolean) => void;
}

export interface DesktopWebViewFactory {
  readonly create: () => DesktopWebViewView;
  readonly attach: (view: DesktopWebViewView) => void;
  readonly detach: (view: DesktopWebViewView) => void;
}

export interface DesktopWebViewServiceOptions {
  readonly factory: DesktopWebViewFactory;
  readonly onUpdate?: (state: DesktopWebViewState) => void;
}

const TRUSTED_HOSTS = new Set([
  'github.com',
  'gist.github.com',
  'vercel.com',
  'supabase.com',
  'openai.com',
  'platform.openai.com',
]);

const TRUSTED_SUFFIXES = [
  '.github.com',
  '.githubusercontent.com',
  '.vercel.com',
  '.vercel.app',
  '.supabase.com',
  '.openai.com',
];

export function createElectronWebViewFactory(
  window: BrowserWindow,
  WebContentsViewConstructor: typeof WebContentsView,
): DesktopWebViewFactory {
  return {
    attach: (view) => {
      window.contentView.addChildView(view as unknown as WebContentsView);
    },
    create: () =>
      new WebContentsViewConstructor({
        webPreferences: createEmbeddedWebPreferences(),
      }) as DesktopWebViewView,
    detach: (view) => {
      window.contentView.removeChildView(view as unknown as WebContentsView);
    },
  };
}

export function createEmbeddedWebPreferences(): WebPreferences {
  return {
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    nodeIntegrationInWorker: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    navigateOnDragDrop: false,
    partition: 'persist:agent-platform-webview',
  };
}

export function classifyDesktopWebViewUrl(value: string): DesktopWebViewPolicy {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { allowed: false, reason: 'WebView URL is invalid.' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      allowed: false,
      reason: 'Only http(s) URLs can open in the workspace WebView.',
    };
  }

  const hostname = normalizeHostname(url.hostname);
  const origin = url.origin;
  if (isLocalPreviewHost(hostname)) {
    return { allowed: true, tier: 'local', origin, normalizedUrl: url.href };
  }

  if (url.protocol === 'http:') {
    return {
      allowed: false,
      externalFallbackUrl: url.href,
      reason: 'Non-local http URLs open in the system browser.',
    };
  }

  if (isTrustedProviderHost(hostname)) {
    return { allowed: true, tier: 'trusted', origin, normalizedUrl: url.href };
  }
  return { allowed: true, tier: 'external', origin, normalizedUrl: url.href };
}

export function shouldAllowDesktopWebViewNavigation(
  current: Pick<DesktopWebViewState, 'origin' | 'policyTier'>,
  targetUrl: string,
): DesktopWebViewPolicy {
  const target = classifyDesktopWebViewUrl(targetUrl);
  if (!target.allowed) return target;
  if (target.origin === current.origin) return target;
  if (target.tier === 'local' || target.tier === 'trusted') return target;
  if (current.policyTier === 'external' && target.tier === 'external') return target;
  return {
    allowed: false,
    externalFallbackUrl: target.normalizedUrl,
    reason: 'Navigation to a new restricted origin was blocked.',
  };
}

export function decodeWorkspaceWebTarget(uri: string): string | null {
  const match = /^workspace:\/\/project\/[^/\s]+\/(preview|webview)\/(.+)$/.exec(uri);
  if (!match) return null;
  try {
    return decodeURIComponent(match[2] ?? '');
  } catch {
    return null;
  }
}

export class DesktopWebViewService {
  readonly #factory: DesktopWebViewFactory;
  readonly #sessions = new Map<string, DesktopWebViewSession>();
  readonly #onUpdate?: (state: DesktopWebViewState) => void;
  #activeWebViewId: string | null = null;

  constructor(options: DesktopWebViewServiceOptions) {
    this.#factory = options.factory;
    this.#onUpdate = options.onUpdate;
  }

  async openResource(uri: string, projectId?: string): Promise<DesktopWorkspaceOpenResult> {
    const targetUrl = decodeWorkspaceWebTarget(uri);
    if (!targetUrl) {
      return {
        ok: true,
        handled: false,
        reason: 'Only preview and webview workspace resources can open in the WebView panel.',
      };
    }
    return this.openWebView({ url: targetUrl, ...(projectId ? { projectId } : {}) });
  }

  async openWebView(request: DesktopWebViewCreateRequest): Promise<DesktopWorkspaceOpenResult> {
    const policy = classifyDesktopWebViewUrl(request.url);
    if (!policy.allowed || !policy.normalizedUrl || !policy.tier || !policy.origin) {
      return {
        ok: true,
        handled: false,
        reason: policy.reason ?? 'WebView URL was blocked by policy.',
        ...(policy.externalFallbackUrl ? { externalFallbackUrl: policy.externalFallbackUrl } : {}),
      };
    }

    const now = new Date().toISOString();
    const view = this.#factory.create();
    const session: DesktopWebViewSession = {
      createdAt: now,
      origin: policy.origin,
      policyTier: policy.tier,
      status: 'loading',
      updatedAt: now,
      url: policy.normalizedUrl,
      view,
      webviewId: `webview-${randomUUID()}`,
      ...(request.projectId ? { projectId: request.projectId } : {}),
      ...(policy.tier === 'external' ? { externalFallbackUrl: policy.normalizedUrl } : {}),
    };

    this.#sessions.set(session.webviewId, session);
    this.#wireSession(session);
    this.#factory.attach(view);
    this.focus(session.webviewId);
    this.#emit(session);
    await view.webContents.loadURL(policy.normalizedUrl);
    return { ok: true, handled: true, webview: this.#state(session) };
  }

  list(): readonly DesktopWebViewState[] {
    return [...this.#sessions.values()].map((session) => this.#state(session));
  }

  focus(webviewId: string): DesktopWebViewState | null {
    const session = this.#sessions.get(webviewId);
    if (!session || session.status === 'closed') return null;
    this.#activeWebViewId = webviewId;
    for (const candidate of this.#sessions.values()) {
      candidate.view.setVisible(candidate.webviewId === webviewId && candidate.status !== 'closed');
    }
    this.#emit(session);
    return this.#state(session);
  }

  close(webviewId: string): DesktopWebViewState | null {
    const session = this.#sessions.get(webviewId);
    if (!session) return null;
    session.status = 'closed';
    session.updatedAt = new Date().toISOString();
    session.view.setVisible(false);
    if (!session.view.webContents.isDestroyed?.()) {
      session.view.webContents.stop();
    }
    this.#factory.detach(session.view);
    const closedState = this.#state(session);
    this.#onUpdate?.(closedState);
    if (!session.view.webContents.isDestroyed?.()) {
      if (session.view.webContents.close) {
        session.view.webContents.close({ waitForBeforeUnload: false });
      } else {
        session.view.webContents.destroy?.();
      }
    }
    this.#sessions.delete(webviewId);
    if (this.#activeWebViewId === webviewId) {
      this.#activeWebViewId = null;
      const next = [...this.#sessions.values()].find(
        (candidate) => candidate.webviewId !== webviewId && candidate.status !== 'closed',
      );
      if (next) this.focus(next.webviewId);
    }
    return closedState;
  }

  setBounds(request: DesktopWebViewBoundsRequest): DesktopWebViewState | null {
    const session = this.#sessions.get(request.webviewId);
    if (!session || session.status === 'closed') return null;
    session.view.setBounds(request.bounds);
    session.view.setVisible(this.#activeWebViewId === session.webviewId);
    return this.#state(session);
  }

  goBack(webviewId: string): DesktopWebViewState | null {
    const session = this.#sessions.get(webviewId);
    if (!session || !session.view.webContents.canGoBack()) {
      return session ? this.#state(session) : null;
    }
    session.view.webContents.goBack();
    return this.#state(session);
  }

  goForward(webviewId: string): DesktopWebViewState | null {
    const session = this.#sessions.get(webviewId);
    if (!session || !session.view.webContents.canGoForward()) {
      return session ? this.#state(session) : null;
    }
    session.view.webContents.goForward();
    return this.#state(session);
  }

  reload(webviewId: string): DesktopWebViewState | null {
    const session = this.#sessions.get(webviewId);
    if (!session || session.status === 'closed') return null;
    session.status = 'loading';
    session.updatedAt = new Date().toISOString();
    session.view.webContents.reload();
    this.#emit(session);
    return this.#state(session);
  }

  disposeAll(): void {
    for (const webviewId of [...this.#sessions.keys()]) {
      this.close(webviewId);
    }
    this.#sessions.clear();
    this.#activeWebViewId = null;
  }

  #wireSession(session: DesktopWebViewSession): void {
    const { webContents } = session.view;
    webContents.setWindowOpenHandler(({ url }) => {
      this.#block(session, url, 'Popups are blocked in workspace WebViews.');
      return { action: 'deny' };
    });
    webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false);
    });
    webContents.session.on('will-download', (event) => {
      event.preventDefault();
      this.#block(session, session.url, 'Downloads are blocked in workspace WebViews.');
    });
    webContents.on('will-navigate', (event, url) => {
      if (!this.#allowNavigation(session, url)) {
        event.preventDefault();
      }
    });
    webContents.on('will-redirect', (event, url) => {
      if (!this.#allowNavigation(session, url)) {
        event.preventDefault();
      }
    });
    webContents.on('did-start-loading', () => {
      this.#update(session, { status: 'loading' });
    });
    webContents.on('did-finish-load', () => {
      this.#update(session, {
        status: 'active',
        title: webContents.getTitle() || undefined,
      });
    });
    webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl) => {
      if (errorCode === -3) return;
      this.#update(session, {
        blockedUrl: validatedUrl || session.url,
        error: errorDescription,
        status: 'error',
      });
    });
    webContents.on('page-title-updated', (_event, title) => {
      this.#update(session, { title });
    });
  }

  #allowNavigation(session: DesktopWebViewSession, url: string): boolean {
    const policy = shouldAllowDesktopWebViewNavigation(this.#state(session), url);
    if (!policy.allowed || !policy.normalizedUrl || !policy.origin || !policy.tier) {
      this.#block(session, url, policy.reason ?? 'Navigation was blocked by policy.');
      return false;
    }
    session.url = policy.normalizedUrl;
    session.origin = policy.origin;
    session.policyTier = policy.tier;
    if (policy.tier === 'external') {
      session.externalFallbackUrl = policy.normalizedUrl;
    }
    session.updatedAt = new Date().toISOString();
    this.#emit(session);
    return true;
  }

  #block(session: DesktopWebViewSession, url: string, reason: string): void {
    this.#update(session, {
      blockedUrl: url,
      error: reason,
      externalFallbackUrl:
        url.startsWith('http://') || url.startsWith('https://') ? url : undefined,
      status: 'blocked',
    });
  }

  #update(
    session: DesktopWebViewSession,
    changes: Partial<
      Pick<
        DesktopWebViewSession,
        'blockedUrl' | 'error' | 'externalFallbackUrl' | 'status' | 'title'
      >
    >,
  ): void {
    Object.assign(session, changes, { updatedAt: new Date().toISOString() });
    this.#emit(session);
  }

  #emit(session: DesktopWebViewSession): void {
    this.#onUpdate?.(this.#state(session));
  }

  #state(session: DesktopWebViewSession): DesktopWebViewState {
    return {
      canGoBack: session.view.webContents.canGoBack(),
      canGoForward: session.view.webContents.canGoForward(),
      createdAt: session.createdAt,
      origin: session.origin,
      policyTier: session.policyTier,
      status: session.status,
      updatedAt: session.updatedAt,
      url: session.url,
      webviewId: session.webviewId,
      ...(session.projectId ? { projectId: session.projectId } : {}),
      ...(session.title ? { title: session.title } : {}),
      ...(session.externalFallbackUrl ? { externalFallbackUrl: session.externalFallbackUrl } : {}),
      ...(session.blockedUrl ? { blockedUrl: session.blockedUrl } : {}),
      ...(session.error ? { error: session.error } : {}),
    };
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function isLocalPreviewHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  );
}

function isTrustedProviderHost(hostname: string): boolean {
  return (
    TRUSTED_HOSTS.has(hostname) || TRUSTED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}

export function preventEventDefault(event: Event): void {
  event.preventDefault();
}
