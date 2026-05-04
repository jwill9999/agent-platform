import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { relative, sep, join } from 'node:path';

import type { Locator, Page } from 'playwright';
import {
  BrowserActionResultSchema,
  BrowserEvidenceArtifactSchema,
  BrowserSessionSchema,
  DEFAULT_BROWSER_POLICY_PROFILE,
  evaluateBrowserUrlPolicy,
  type BrowserActionResult,
  type BrowserActionTarget,
  type BrowserEvidenceArtifact,
  type BrowserPageState,
  type BrowserPolicyDecision,
  type BrowserPolicyProfile,
  type BrowserSession,
  type BrowserViewport,
  type Output,
  type Tool as ContractTool,
} from '@agent-platform/contracts';
import {
  SYSTEM_TOOL_PREFIX,
  buildRiskMap,
  errorMessage,
  stringArg,
  toolResult,
} from './toolHelpers.js';

const DEFAULT_SESSION_TIMEOUT_MS = 600_000;
const DEFAULT_VIEWPORT: BrowserViewport = {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
  isMobile: false,
};
const DEFAULT_TEXT_BYTES = 200_000;
const DEFAULT_SCREENSHOT_BYTES = 12_000_000;
const DEFAULT_BROWSER_TEMP_SUBDIR = '.agent-platform/tmp/browser';

export const BROWSER_TOOL_IDS = {
  start: `${SYSTEM_TOOL_PREFIX}browser_start`,
  navigate: `${SYSTEM_TOOL_PREFIX}browser_navigate`,
  snapshot: `${SYSTEM_TOOL_PREFIX}browser_snapshot`,
  screenshot: `${SYSTEM_TOOL_PREFIX}browser_screenshot`,
  click: `${SYSTEM_TOOL_PREFIX}browser_click`,
  type: `${SYSTEM_TOOL_PREFIX}browser_type`,
  press: `${SYSTEM_TOOL_PREFIX}browser_press`,
  close: `${SYSTEM_TOOL_PREFIX}browser_close`,
} as const;

export const BROWSER_TOOL_MAP = {
  ...buildRiskMap(
    {
      start: BROWSER_TOOL_IDS.start,
      navigate: BROWSER_TOOL_IDS.navigate,
      close: BROWSER_TOOL_IDS.close,
    },
    'medium',
  ),
  ...buildRiskMap(
    { snapshot: BROWSER_TOOL_IDS.snapshot, screenshot: BROWSER_TOOL_IDS.screenshot },
    'low',
  ),
  ...buildRiskMap(
    { click: BROWSER_TOOL_IDS.click, type: BROWSER_TOOL_IDS.type, press: BROWSER_TOOL_IDS.press },
    'high',
  ),
};

export const BROWSER_TOOLS: readonly ContractTool[] = [
  {
    id: BROWSER_TOOL_IDS.start,
    slug: 'sys-browser-start',
    name: 'browser_start',
    description:
      'Start or reuse a governed Playwright browser session, optionally opening an allowed local/dev URL.',
    riskTier: 'medium',
    requiresApproval: false,
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Optional existing browser session id.' },
          url: {
            type: 'string',
            description: 'Optional initial URL. External domains need policy.',
          },
          timeoutMs: { type: 'number', description: 'Action timeout in milliseconds.' },
        },
      },
    },
  },
  {
    id: BROWSER_TOOL_IDS.navigate,
    slug: 'sys-browser-navigate',
    name: 'browser_navigate',
    description:
      'Navigate an active governed browser session after URL policy checks and redirect validation.',
    riskTier: 'medium',
    requiresApproval: false,
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Browser session id.' },
          url: { type: 'string', description: 'URL to navigate to.' },
          timeoutMs: { type: 'number', description: 'Navigation timeout in milliseconds.' },
        },
        required: ['sessionId', 'url'],
      },
    },
  },
  {
    id: BROWSER_TOOL_IDS.snapshot,
    slug: 'sys-browser-snapshot',
    name: 'browser_snapshot',
    description: 'Capture read-only DOM and ARIA snapshot evidence from an active browser session.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Browser session id.' },
          maxBytes: { type: 'number', description: 'Maximum bytes per text artifact.' },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    id: BROWSER_TOOL_IDS.click,
    slug: 'sys-browser-click',
    name: 'browser_click',
    description:
      'Click a page target using user-facing locator attributes when possible. Risky actions require approval.',
    riskTier: 'high',
    requiresApproval: true,
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Browser session id.' },
          target: {
            type: 'object',
            description: 'Role, label, text, test id, or selector target.',
          },
          submitLike: { type: 'boolean', description: 'Whether the click may submit data.' },
          destructive: { type: 'boolean', description: 'Whether the click may delete or destroy.' },
          approved: { type: 'boolean', description: 'Set by an approval path when approved.' },
        },
        required: ['sessionId', 'target'],
      },
    },
  },
  {
    id: BROWSER_TOOL_IDS.type,
    slug: 'sys-browser-type',
    name: 'browser_type',
    description:
      'Fill a page target using user-facing locator attributes. Sensitive input requires approval.',
    riskTier: 'high',
    requiresApproval: true,
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Browser session id.' },
          target: {
            type: 'object',
            description: 'Role, label, text, test id, or selector target.',
          },
          text: { type: 'string', description: 'Text to enter.' },
          sensitive: {
            type: 'boolean',
            description: 'Whether input contains credentials/secrets.',
          },
          approved: { type: 'boolean', description: 'Set by an approval path when approved.' },
        },
        required: ['sessionId', 'target', 'text'],
      },
    },
  },
  {
    id: BROWSER_TOOL_IDS.press,
    slug: 'sys-browser-press',
    name: 'browser_press',
    description:
      'Press a key on a page target using user-facing locator attributes. Submit-like actions require approval.',
    riskTier: 'high',
    requiresApproval: true,
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Browser session id.' },
          target: {
            type: 'object',
            description: 'Optional role, label, text, test id, or selector target.',
          },
          key: { type: 'string', description: 'Key to press, for example Enter.' },
          submitLike: { type: 'boolean', description: 'Whether the key press may submit data.' },
          approved: { type: 'boolean', description: 'Set by an approval path when approved.' },
        },
        required: ['sessionId', 'key'],
      },
    },
  },
  {
    id: BROWSER_TOOL_IDS.screenshot,
    slug: 'sys-browser-screenshot',
    name: 'browser_screenshot',
    description: 'Capture read-only screenshot evidence from an active browser session.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Browser session id.' },
          fullPage: { type: 'boolean', description: 'Capture the full page when true.' },
          maxBytes: { type: 'number', description: 'Maximum screenshot artifact bytes.' },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    id: BROWSER_TOOL_IDS.close,
    slug: 'sys-browser-close',
    name: 'browser_close',
    description: 'Close a governed browser session and release its Playwright context.',
    riskTier: 'medium',
    requiresApproval: false,
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Browser session id.' },
        },
        required: ['sessionId'],
      },
    },
  },
];

export type BrowserPageDriver = {
  url(): string;
  title(): Promise<string>;
  viewportSize(): { width: number; height: number } | null;
  goto(url: string, options?: { waitUntil?: 'load'; timeout?: number }): Promise<unknown>;
  screenshot(options: { fullPage?: boolean; timeout?: number }): Promise<Buffer>;
  content(): Promise<string>;
  ariaSnapshot(): Promise<string>;
  locator(target: BrowserActionTarget): BrowserLocatorDriver;
  close(): Promise<unknown>;
};

export type BrowserLocatorDriver = {
  count(): Promise<number>;
  click(options: { timeout?: number }): Promise<unknown>;
  fill(text: string, options: { timeout?: number }): Promise<unknown>;
  press(key: string, options: { timeout?: number }): Promise<unknown>;
};

export type BrowserRuntimeSession = {
  page: BrowserPageDriver;
  close(): Promise<unknown>;
};

export type BrowserDriver = {
  launch(options: {
    viewport: BrowserViewport;
    timeoutMs: number;
    browserTempRoot?: string;
  }): Promise<BrowserRuntimeSession>;
};

type StoredSession = {
  session: BrowserSession;
  runtime: BrowserRuntimeSession;
  consoleMessages: string[];
};

type BrowserSessionManagerOptions = {
  driver?: BrowserDriver;
  workspaceRoot?: string;
  browserTempRoot?: string;
  now?: () => number;
  sessionTimeoutMs?: number;
  policyProfile?: BrowserPolicyProfile;
};

type StartOptions = {
  sessionId?: string;
  url?: string;
  viewport?: BrowserViewport;
  timeoutMs?: number;
  approved?: boolean;
};

type NavigateOptions = {
  sessionId: string;
  url: string;
  timeoutMs?: number;
  approved?: boolean;
};

type InteractionOptions = {
  sessionId: string;
  target?: BrowserActionTarget;
  timeoutMs?: number;
  text?: string;
  key?: string;
};

type ArtifactInput = {
  sessionId: string;
  actionId: string;
  kind: BrowserEvidenceArtifact['kind'];
  label: string;
  mimeType: string;
  extension: string;
  content: string | Buffer;
  maxBytes: number;
  pageUrl?: string;
  viewport?: BrowserViewport;
  metadata?: Record<string, unknown>;
};

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function byteLength(content: string | Buffer): number {
  return typeof content === 'string' ? Buffer.byteLength(content, 'utf-8') : content.byteLength;
}

function boundContent(
  content: string | Buffer,
  maxBytes: number,
): {
  content: string | Buffer;
  originalSizeBytes: number;
  storedSizeBytes: number;
  truncated: boolean;
} {
  const originalSizeBytes = byteLength(content);
  if (originalSizeBytes <= maxBytes) {
    return { content, originalSizeBytes, storedSizeBytes: originalSizeBytes, truncated: false };
  }
  if (typeof content === 'string') {
    const bytes = Buffer.from(content, 'utf-8');
    const truncated = bytes.subarray(0, maxBytes).toString('utf-8');
    return {
      content: truncated,
      originalSizeBytes,
      storedSizeBytes: Buffer.byteLength(truncated, 'utf-8'),
      truncated: true,
    };
  }
  const truncated = content.subarray(0, maxBytes);
  return {
    content: truncated,
    originalSizeBytes,
    storedSizeBytes: truncated.byteLength,
    truncated: true,
  };
}

function buildAllowedDecision(kind: BrowserActionResult['kind']): BrowserPolicyDecision {
  return {
    state: 'allowed',
    riskTier: kind === 'snapshot' || kind === 'screenshot' ? 'low' : 'medium',
    reasons: ['Browser action is allowed by policy'],
    matchedRule: 'action_allowed',
  };
}

function buildApprovalDecision(reason: string): BrowserPolicyDecision {
  return {
    state: 'approval_required',
    riskTier: 'high',
    reasons: [reason],
    matchedRule: 'risky_browser_action_requires_approval',
  };
}

function isRiskyInteraction(args: Record<string, unknown>): string | null {
  if (args.approved === true) return null;
  if (args.submitLike === true) return 'Submit-like browser action requires approval';
  if (args.destructive === true) return 'Destructive browser action requires approval';
  if (args.sensitive === true) return 'Sensitive browser input requires approval';
  return null;
}

function runtimeUnavailableMessage(message: string): string {
  return (
    'Playwright browser runtime is unavailable. Ensure Chromium is installed in the Docker image, ' +
    `browser dependencies are present, and sandbox permissions allow launch. ${message}`
  );
}

class BrowserTargetError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BrowserTargetError';
    this.code = code;
  }
}

function normalizeViewport(viewport: { width: number; height: number } | null): BrowserViewport {
  if (!viewport) return DEFAULT_VIEWPORT;
  return {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    isMobile: false,
  };
}

function buildResult(input: {
  kind: BrowserActionResult['kind'];
  sessionId?: string;
  status: BrowserActionResult['status'];
  policyDecision: BrowserPolicyDecision;
  page?: BrowserActionResult['page'];
  evidence?: BrowserEvidenceArtifact[];
  startedAtMs: number;
  completedAtMs: number;
  error?: BrowserActionResult['error'];
}): BrowserActionResult {
  return BrowserActionResultSchema.parse({
    id: `browser-action-${randomUUID()}`,
    kind: input.kind,
    sessionId: input.sessionId,
    status: input.status,
    policyDecision: input.policyDecision,
    page: input.page,
    evidence: input.evidence ?? [],
    startedAtMs: input.startedAtMs,
    completedAtMs: input.completedAtMs,
    durationMs: input.completedAtMs - input.startedAtMs,
    error: input.error,
  });
}

export class PlaywrightBrowserDriver implements BrowserDriver {
  async launch(options: {
    viewport: BrowserViewport;
    timeoutMs: number;
    browserTempRoot?: string;
  }): Promise<BrowserRuntimeSession> {
    const playwright = await import('playwright');
    const executablePath = resolveChromiumExecutablePath();
    const launchTempRoot = await createBrowserLaunchTempRoot(options.browserTempRoot);
    try {
      const context = await playwright.chromium.launchPersistentContext(
        join(launchTempRoot, 'user-data'),
        {
          headless: true,
          timeout: options.timeoutMs,
          executablePath,
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
          viewport: options.viewport,
          artifactsDir: join(launchTempRoot, 'artifacts'),
          downloadsPath: join(launchTempRoot, 'downloads'),
          tracesDir: join(launchTempRoot, 'traces'),
        },
      );
      const page = context.pages()[0] ?? (await context.newPage());
      return {
        page: {
          url: () => page.url(),
          title: () => page.title(),
          viewportSize: () => page.viewportSize(),
          goto: (url, gotoOptions) => page.goto(url, gotoOptions),
          screenshot: (screenshotOptions) => page.screenshot(screenshotOptions),
          content: () => page.content(),
          ariaSnapshot: () => page.locator('body').ariaSnapshot({ timeout: 2_000 }),
          locator: (target) => {
            const locator = resolvePlaywrightLocator(page, target);
            return {
              count: () => locator.count(),
              click: (clickOptions) => locator.click(clickOptions),
              fill: (text, fillOptions) => locator.fill(text, fillOptions),
              press: (key, pressOptions) => locator.press(key, pressOptions),
            };
          },
          close: () => page.close(),
        },
        close: async () => {
          try {
            await context.close();
          } finally {
            await rm(launchTempRoot, { recursive: true, force: true });
          }
        },
      };
    } catch (error) {
      await rm(launchTempRoot, { recursive: true, force: true });
      throw error;
    }
  }
}

function resolveBrowserTempRoot(options: {
  configuredTempRoot?: string;
  workspaceRoot?: string;
}): string | undefined {
  if (options.configuredTempRoot) return options.configuredTempRoot;
  if (!options.workspaceRoot || !existsSync(options.workspaceRoot)) return undefined;
  return join(options.workspaceRoot, DEFAULT_BROWSER_TEMP_SUBDIR);
}

async function createBrowserLaunchTempRoot(tempRoot: string | undefined): Promise<string> {
  const root = tempRoot ?? join(process.cwd(), DEFAULT_BROWSER_TEMP_SUBDIR);
  await mkdir(root, { recursive: true });
  return mkdtemp(join(root, 'playwright-'));
}

function resolvePlaywrightLocator(page: Page, target: BrowserActionTarget): Locator {
  if (target.role) {
    const name = target.label ?? target.text;
    const getByRole = page.getByRole.bind(page) as (
      role: string,
      options: { name?: string | RegExp },
    ) => Locator;
    return getByRole(target.role, { name });
  }
  if (target.label) return page.getByLabel(target.label);
  if (target.text) return page.getByText(target.text);
  if (target.placeholder) return page.getByPlaceholder(target.placeholder);
  if (target.altText) return page.getByAltText(target.altText);
  if (target.title) return page.getByTitle(target.title);
  if (target.testId) return page.getByTestId(target.testId);
  if (target.selector) return page.locator(target.selector);
  throw new Error('Target does not include a supported locator strategy');
}

function resolveChromiumExecutablePath(): string | undefined {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (configured) return configured;
  return [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((candidate) => existsSync(candidate));
}

export class BrowserSessionManager {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly driver: BrowserDriver;
  private readonly workspaceRoot: string;
  private readonly browserTempRoot: string | undefined;
  private readonly now: () => number;
  private readonly sessionTimeoutMs: number;
  private readonly policyProfile: BrowserPolicyProfile;

  constructor(options: BrowserSessionManagerOptions = {}) {
    this.driver = options.driver ?? new PlaywrightBrowserDriver();
    const workspaceRoot = options.workspaceRoot ?? process.cwd();
    this.workspaceRoot = workspaceRoot;
    this.browserTempRoot = resolveBrowserTempRoot({
      configuredTempRoot: options.browserTempRoot ?? process.env.AGENT_BROWSER_TMPDIR,
      workspaceRoot,
    });
    this.now = options.now ?? Date.now;
    this.sessionTimeoutMs =
      options.sessionTimeoutMs ??
      options.policyProfile?.sessionTimeoutMs ??
      DEFAULT_SESSION_TIMEOUT_MS;
    this.policyProfile = options.policyProfile ?? DEFAULT_BROWSER_POLICY_PROFILE;
  }

  async start(options: StartOptions): Promise<BrowserSession> {
    if (options.sessionId) {
      const existing = await this.getActiveSession(options.sessionId);
      if (existing) return existing.session;
    }

    const viewport = options.viewport ?? DEFAULT_VIEWPORT;
    if (this.browserTempRoot) await mkdir(this.browserTempRoot, { recursive: true });
    const runtime = await this.driver.launch({
      viewport,
      timeoutMs: options.timeoutMs ?? 30_000,
      browserTempRoot: this.browserTempRoot,
    });

    const id = options.sessionId ?? `browser-session-${randomUUID()}`;
    if (options.url) {
      await runtime.page.goto(options.url, { waitUntil: 'load', timeout: options.timeoutMs });
    }

    const now = this.now();
    const session = BrowserSessionSchema.parse({
      id,
      provider: 'playwright',
      status: 'active',
      page: await this.readPageState(runtime.page, now),
      policyProfileId: this.policyProfile.id,
      createdAtMs: now,
      updatedAtMs: now,
      expiresAtMs: now + this.sessionTimeoutMs,
      lastActionAtMs: now,
      artifactCount: 0,
    });
    this.sessions.set(id, { session, runtime, consoleMessages: [] });
    return session;
  }

  async getActiveSession(sessionId: string): Promise<StoredSession | null> {
    const stored = this.sessions.get(sessionId);
    if (!stored) return null;
    const now = this.now();
    if (stored.session.expiresAtMs !== undefined && now > stored.session.expiresAtMs) {
      await this.close(sessionId, 'expired');
      return null;
    }
    return stored;
  }

  async snapshot(
    sessionId: string,
    maxBytes: number,
  ): Promise<{
    session: BrowserSession;
    evidence: BrowserEvidenceArtifact[];
  } | null> {
    const stored = await this.getActiveSession(sessionId);
    if (!stored) return null;
    const actionId = `browser-action-${randomUUID()}`;
    const pageState = await this.readPageState(stored.runtime.page, this.now());
    const domSummary = await stored.runtime.page.content();
    const ariaSnapshot = await stored.runtime.page.ariaSnapshot();
    const evidence = [
      await this.writeArtifact({
        sessionId,
        actionId,
        kind: 'dom_summary',
        label: 'DOM summary',
        mimeType: 'text/html',
        extension: 'html',
        content: domSummary,
        maxBytes,
        pageUrl: pageState.url,
        viewport: pageState.viewport,
      }),
      await this.writeArtifact({
        sessionId,
        actionId,
        kind: 'aria_snapshot',
        label: 'ARIA snapshot',
        mimeType: 'text/plain',
        extension: 'txt',
        content: ariaSnapshot,
        maxBytes,
        pageUrl: pageState.url,
        viewport: pageState.viewport,
      }),
    ];
    return { session: this.touch(stored, pageState, evidence.length), evidence };
  }

  async navigate(options: NavigateOptions): Promise<{
    session: BrowserSession;
    evidence: BrowserEvidenceArtifact[];
    policyDecision: BrowserPolicyDecision;
  } | null> {
    const stored = await this.getActiveSession(options.sessionId);
    if (!stored) return null;
    const before = await this.capturePageEvidence(
      options.sessionId,
      'Before navigation',
      DEFAULT_TEXT_BYTES,
    );
    await stored.runtime.page.goto(options.url, {
      waitUntil: 'load',
      timeout: options.timeoutMs ?? 30_000,
    });
    const pageState = await this.readPageState(stored.runtime.page, this.now());
    const policyDecision = evaluateBrowserUrlPolicy(pageState.url, this.policyProfile);
    if (policyDecision.state !== 'allowed') {
      if (options.approved && policyDecision.state === 'approval_required') {
        const after = await this.capturePageEvidence(
          options.sessionId,
          'After navigation',
          DEFAULT_TEXT_BYTES,
        );
        return {
          session: this.touch(stored, pageState, before.length + after.length),
          evidence: [...before, ...after],
          policyDecision: buildApprovedUrlDecision('navigate'),
        };
      }
      return {
        session: this.touch(stored, pageState, before.length),
        evidence: before,
        policyDecision,
      };
    }
    const after = await this.capturePageEvidence(
      options.sessionId,
      'After navigation',
      DEFAULT_TEXT_BYTES,
    );
    return {
      session: this.touch(stored, pageState, before.length + after.length),
      evidence: [...before, ...after],
      policyDecision,
    };
  }

  async click(options: InteractionOptions): Promise<{
    session: BrowserSession;
    evidence: BrowserEvidenceArtifact[];
  } | null> {
    const stored = await this.getActiveSession(options.sessionId);
    if (!stored || !options.target) return null;
    const locator = await this.resolveUniqueLocator(stored.runtime.page, options.target);
    const before = await this.capturePageEvidence(
      options.sessionId,
      'Before click',
      DEFAULT_TEXT_BYTES,
    );
    await locator.click({ timeout: options.timeoutMs ?? 30_000 });
    const after = await this.capturePageEvidence(
      options.sessionId,
      'After click',
      DEFAULT_TEXT_BYTES,
    );
    const pageState = await this.readPageState(stored.runtime.page, this.now());
    return {
      session: this.touch(stored, pageState, before.length + after.length),
      evidence: [...before, ...after],
    };
  }

  async type(options: InteractionOptions): Promise<{
    session: BrowserSession;
    evidence: BrowserEvidenceArtifact[];
  } | null> {
    const stored = await this.getActiveSession(options.sessionId);
    if (!stored || !options.target || options.text === undefined) return null;
    const locator = await this.resolveUniqueLocator(stored.runtime.page, options.target);
    const before = await this.capturePageEvidence(
      options.sessionId,
      'Before type',
      DEFAULT_TEXT_BYTES,
    );
    await locator.fill(options.text, { timeout: options.timeoutMs ?? 30_000 });
    const after = await this.capturePageEvidence(
      options.sessionId,
      'After type',
      DEFAULT_TEXT_BYTES,
    );
    const pageState = await this.readPageState(stored.runtime.page, this.now());
    return {
      session: this.touch(stored, pageState, before.length + after.length),
      evidence: [...before, ...after],
    };
  }

  async press(options: InteractionOptions): Promise<{
    session: BrowserSession;
    evidence: BrowserEvidenceArtifact[];
  } | null> {
    const stored = await this.getActiveSession(options.sessionId);
    if (!stored || !options.key) return null;
    const locator = options.target
      ? await this.resolveUniqueLocator(stored.runtime.page, options.target)
      : stored.runtime.page.locator({ selector: 'body' });
    const before = await this.capturePageEvidence(
      options.sessionId,
      'Before key press',
      DEFAULT_TEXT_BYTES,
    );
    await locator.press(options.key, { timeout: options.timeoutMs ?? 30_000 });
    const after = await this.capturePageEvidence(
      options.sessionId,
      'After key press',
      DEFAULT_TEXT_BYTES,
    );
    const pageState = await this.readPageState(stored.runtime.page, this.now());
    return {
      session: this.touch(stored, pageState, before.length + after.length),
      evidence: [...before, ...after],
    };
  }

  async screenshot(
    sessionId: string,
    maxBytes: number,
    fullPage: boolean,
  ): Promise<{
    session: BrowserSession;
    evidence: BrowserEvidenceArtifact[];
  } | null> {
    const stored = await this.getActiveSession(sessionId);
    if (!stored) return null;
    const actionId = `browser-action-${randomUUID()}`;
    const pageState = await this.readPageState(stored.runtime.page, this.now());
    const screenshot = await stored.runtime.page.screenshot({ fullPage, timeout: 30_000 });
    const artifact = await this.writeArtifact({
      sessionId,
      actionId,
      kind: 'screenshot',
      label: 'Browser screenshot',
      mimeType: 'image/png',
      extension: 'png',
      content: screenshot,
      maxBytes,
      pageUrl: pageState.url,
      viewport: pageState.viewport,
      metadata: { fullPage },
    });
    return { session: this.touch(stored, pageState, 1), evidence: [artifact] };
  }

  async close(
    sessionId: string,
    status: BrowserSession['status'] = 'closed',
  ): Promise<BrowserSession | null> {
    const stored = this.sessions.get(sessionId);
    if (!stored) return null;
    await stored.runtime.close();
    const now = this.now();
    const session = BrowserSessionSchema.parse({
      ...stored.session,
      status,
      updatedAtMs: now,
      lastActionAtMs: now,
    });
    this.sessions.delete(sessionId);
    return session;
  }

  private async readPageState(
    page: BrowserPageDriver,
    loadedAtMs: number,
  ): Promise<BrowserPageState> {
    return {
      url: page.url() || 'about:blank',
      title: await page.title(),
      viewport: normalizeViewport(page.viewportSize()),
      loadedAtMs,
    };
  }

  private touch(
    stored: StoredSession,
    page: BrowserSession['page'],
    artifactCountIncrement: number,
  ): BrowserSession {
    const now = this.now();
    const session = BrowserSessionSchema.parse({
      ...stored.session,
      page,
      status: 'active',
      updatedAtMs: now,
      lastActionAtMs: now,
      expiresAtMs: now + this.sessionTimeoutMs,
      artifactCount: stored.session.artifactCount + artifactCountIncrement,
    });
    stored.session = session;
    return session;
  }

  private async resolveUniqueLocator(
    page: BrowserPageDriver,
    target: BrowserActionTarget,
  ): Promise<BrowserLocatorDriver> {
    const locator = page.locator(target);
    const count = await locator.count();
    if (count === 0) {
      throw new BrowserTargetError('BROWSER_TARGET_NOT_FOUND', 'Browser target was not found');
    }
    if (count > 1) {
      throw new BrowserTargetError(
        'BROWSER_TARGET_AMBIGUOUS',
        `Browser target matched ${count} elements`,
      );
    }
    return locator;
  }

  private async capturePageEvidence(
    sessionId: string,
    labelPrefix: string,
    maxBytes: number,
  ): Promise<BrowserEvidenceArtifact[]> {
    const stored = await this.getActiveSession(sessionId);
    if (!stored) return [];
    const actionId = `browser-action-${randomUUID()}`;
    const pageState = await this.readPageState(stored.runtime.page, this.now());
    const domSummary = await stored.runtime.page.content();
    const ariaSnapshot = await stored.runtime.page.ariaSnapshot();
    return [
      await this.writeArtifact({
        sessionId,
        actionId,
        kind: 'dom_summary',
        label: `${labelPrefix} DOM summary`,
        mimeType: 'text/html',
        extension: 'html',
        content: domSummary,
        maxBytes,
        pageUrl: pageState.url,
        viewport: pageState.viewport,
      }),
      await this.writeArtifact({
        sessionId,
        actionId,
        kind: 'aria_snapshot',
        label: `${labelPrefix} ARIA snapshot`,
        mimeType: 'text/plain',
        extension: 'txt',
        content: ariaSnapshot,
        maxBytes,
        pageUrl: pageState.url,
        viewport: pageState.viewport,
      }),
    ];
  }

  private async writeArtifact(input: ArtifactInput): Promise<BrowserEvidenceArtifact> {
    const artifactId = `browser-artifact-${randomUUID()}`;
    const bounded = boundContent(input.content, input.maxBytes);
    const dir = join(this.workspaceRoot, '.agent-platform', 'browser', input.sessionId);
    await mkdir(dir, { recursive: true });
    const uri = join(dir, `${artifactId}.${input.extension}`);
    const workspaceRelativePath = relative(this.workspaceRoot, uri).split(sep).join('/');
    await writeFile(uri, bounded.content);
    const artifact = BrowserEvidenceArtifactSchema.parse({
      id: artifactId,
      sessionId: input.sessionId,
      actionId: input.actionId,
      kind: input.kind,
      storage: 'workspace_file',
      label: input.label,
      mimeType: input.mimeType,
      uri,
      sizeBytes: bounded.originalSizeBytes,
      maxBytes: input.maxBytes,
      truncated: bounded.truncated,
      redaction: {
        secretsRedacted: true,
        inputTextRedacted: input.kind !== 'screenshot',
        urlsRedacted: false,
        screenshotMasked: false,
      },
      sha256: sha256(bounded.content),
      pageUrl: input.pageUrl,
      viewport: input.viewport,
      capturedAtMs: this.now(),
      metadata: {
        ...input.metadata,
        storedSizeBytes: bounded.storedSizeBytes,
        workspaceRelativePath,
      },
    });
    await writeFile(`${uri}.json`, JSON.stringify(artifact, null, 2), 'utf-8');
    return artifact;
  }
}

type BrowserToolOptions = {
  manager?: BrowserSessionManager;
  workspaceRoot?: string;
};

function managerFromOptions(options?: BrowserToolOptions): BrowserSessionManager {
  return options?.manager ?? new BrowserSessionManager({ workspaceRoot: options?.workspaceRoot });
}

function resultEnvelope(toolId: string, result: BrowserActionResult): Output {
  return toolResult(toolId, result as unknown as Record<string, unknown>);
}

function isApprovedUrlPolicyOverride(args: Record<string, unknown>): boolean {
  return args.approved === true;
}

function buildApprovedUrlDecision(kind: string): BrowserPolicyDecision {
  return {
    state: 'allowed',
    riskTier: 'medium',
    reasons: [`Human approved browser ${kind} for an external URL`],
    matchedRule: 'browser_url_approved',
  };
}

async function handleStart(
  toolId: string,
  args: Record<string, unknown>,
  manager: BrowserSessionManager,
): Promise<Output> {
  const startedAtMs = Date.now();
  const url = stringArg(args, 'url');
  const sessionId = stringArg(args, 'sessionId');
  if (url) {
    const policyDecision = evaluateBrowserUrlPolicy(url);
    if (
      policyDecision.state === 'denied' ||
      (policyDecision.state !== 'allowed' && !isApprovedUrlPolicyOverride(args))
    ) {
      return resultEnvelope(
        toolId,
        buildResult({
          kind: 'start',
          sessionId: sessionId || undefined,
          status: policyDecision.state,
          policyDecision,
          startedAtMs,
          completedAtMs: Date.now(),
        }),
      );
    }
  }

  try {
    const session = await manager.start({
      sessionId: sessionId || undefined,
      url: url || undefined,
      timeoutMs: typeof args.timeoutMs === 'number' ? args.timeoutMs : undefined,
      approved: isApprovedUrlPolicyOverride(args),
    });
    return resultEnvelope(
      toolId,
      buildResult({
        kind: 'start',
        sessionId: session.id,
        status: 'succeeded',
        policyDecision:
          url && isApprovedUrlPolicyOverride(args)
            ? buildApprovedUrlDecision('start')
            : buildAllowedDecision('start'),
        page: session.page,
        startedAtMs,
        completedAtMs: Date.now(),
      }),
    );
  } catch (err) {
    return resultEnvelope(
      toolId,
      buildResult({
        kind: 'start',
        status: 'failed',
        policyDecision: buildAllowedDecision('start'),
        startedAtMs,
        completedAtMs: Date.now(),
        error: {
          code: 'BROWSER_RUNTIME_UNAVAILABLE',
          message: runtimeUnavailableMessage(errorMessage(err)),
        },
      }),
    );
  }
}

async function handleNavigate(
  toolId: string,
  args: Record<string, unknown>,
  manager: BrowserSessionManager,
): Promise<Output> {
  const startedAtMs = Date.now();
  const sessionId = stringArg(args, 'sessionId');
  const url = stringArg(args, 'url');
  const policyDecision = evaluateBrowserUrlPolicy(url);
  if (
    policyDecision.state === 'denied' ||
    (policyDecision.state !== 'allowed' && !isApprovedUrlPolicyOverride(args))
  ) {
    return resultEnvelope(
      toolId,
      buildResult({
        kind: 'navigate',
        sessionId,
        status: policyDecision.state,
        policyDecision,
        startedAtMs,
        completedAtMs: Date.now(),
      }),
    );
  }

  try {
    const navigation = await manager.navigate({
      sessionId,
      url,
      timeoutMs: typeof args.timeoutMs === 'number' ? args.timeoutMs : undefined,
      approved: isApprovedUrlPolicyOverride(args),
    });
    if (!navigation) {
      return unavailableSessionResult(toolId, 'navigate', sessionId, startedAtMs);
    }
    return resultEnvelope(
      toolId,
      buildResult({
        kind: 'navigate',
        sessionId,
        status:
          navigation.policyDecision.state === 'allowed'
            ? 'succeeded'
            : navigation.policyDecision.state,
        policyDecision: navigation.policyDecision,
        page: navigation.session.page,
        evidence: navigation.evidence,
        startedAtMs,
        completedAtMs: Date.now(),
      }),
    );
  } catch (err) {
    return browserActionFailure(toolId, 'navigate', sessionId, startedAtMs, err);
  }
}

async function handleSnapshot(
  toolId: string,
  args: Record<string, unknown>,
  manager: BrowserSessionManager,
): Promise<Output> {
  const startedAtMs = Date.now();
  const sessionId = stringArg(args, 'sessionId');
  const maxBytes =
    typeof args.maxBytes === 'number'
      ? Math.min(Math.max(1, args.maxBytes), DEFAULT_TEXT_BYTES)
      : DEFAULT_TEXT_BYTES;
  const snapshot = await manager.snapshot(sessionId, maxBytes);
  if (!snapshot) {
    return resultEnvelope(
      toolId,
      buildResult({
        kind: 'snapshot',
        sessionId,
        status: 'failed',
        policyDecision: buildAllowedDecision('snapshot'),
        startedAtMs,
        completedAtMs: Date.now(),
        error: { code: 'BROWSER_SESSION_UNAVAILABLE', message: 'Browser session is not active' },
      }),
    );
  }
  return resultEnvelope(
    toolId,
    buildResult({
      kind: 'snapshot',
      sessionId,
      status: 'succeeded',
      policyDecision: buildAllowedDecision('snapshot'),
      page: snapshot.session.page,
      evidence: snapshot.evidence,
      startedAtMs,
      completedAtMs: Date.now(),
    }),
  );
}

async function handleScreenshot(
  toolId: string,
  args: Record<string, unknown>,
  manager: BrowserSessionManager,
): Promise<Output> {
  const startedAtMs = Date.now();
  const sessionId = stringArg(args, 'sessionId');
  const maxBytes =
    typeof args.maxBytes === 'number'
      ? Math.min(Math.max(1, args.maxBytes), DEFAULT_SCREENSHOT_BYTES)
      : DEFAULT_SCREENSHOT_BYTES;
  const screenshot = await manager.screenshot(sessionId, maxBytes, args.fullPage === true);
  if (!screenshot) {
    return resultEnvelope(
      toolId,
      buildResult({
        kind: 'screenshot',
        sessionId,
        status: 'failed',
        policyDecision: buildAllowedDecision('screenshot'),
        startedAtMs,
        completedAtMs: Date.now(),
        error: { code: 'BROWSER_SESSION_UNAVAILABLE', message: 'Browser session is not active' },
      }),
    );
  }
  return resultEnvelope(
    toolId,
    buildResult({
      kind: 'screenshot',
      sessionId,
      status: 'succeeded',
      policyDecision: buildAllowedDecision('screenshot'),
      page: screenshot.session.page,
      evidence: screenshot.evidence,
      startedAtMs,
      completedAtMs: Date.now(),
    }),
  );
}

async function handleClick(
  toolId: string,
  args: Record<string, unknown>,
  manager: BrowserSessionManager,
): Promise<Output> {
  return handleInteraction(toolId, 'click', args, manager);
}

async function handleType(
  toolId: string,
  args: Record<string, unknown>,
  manager: BrowserSessionManager,
): Promise<Output> {
  return handleInteraction(toolId, 'type', args, manager);
}

async function handlePress(
  toolId: string,
  args: Record<string, unknown>,
  manager: BrowserSessionManager,
): Promise<Output> {
  return handleInteraction(toolId, 'press', args, manager);
}

async function handleInteraction(
  toolId: string,
  kind: 'click' | 'type' | 'press',
  args: Record<string, unknown>,
  manager: BrowserSessionManager,
): Promise<Output> {
  const startedAtMs = Date.now();
  const sessionId = stringArg(args, 'sessionId');
  const approvalReason = isRiskyInteraction(args);
  if (approvalReason) {
    const policyDecision = buildApprovalDecision(approvalReason);
    return resultEnvelope(
      toolId,
      buildResult({
        kind,
        sessionId,
        status: 'approval_required',
        policyDecision,
        startedAtMs,
        completedAtMs: Date.now(),
      }),
    );
  }

  try {
    const target =
      typeof args.target === 'object' && args.target !== null
        ? (args.target as BrowserActionTarget)
        : undefined;
    const timeoutMs = typeof args.timeoutMs === 'number' ? args.timeoutMs : undefined;
    let result: Awaited<ReturnType<BrowserSessionManager['click']>>;
    if (kind === 'click') {
      result = await manager.click({ sessionId, target, timeoutMs });
    } else if (kind === 'type') {
      result = await manager.type({ sessionId, target, timeoutMs, text: stringArg(args, 'text') });
    } else {
      result = await manager.press({ sessionId, target, timeoutMs, key: stringArg(args, 'key') });
    }
    if (!result) {
      return unavailableSessionResult(toolId, kind, sessionId, startedAtMs);
    }
    return resultEnvelope(
      toolId,
      buildResult({
        kind,
        sessionId,
        status: 'succeeded',
        policyDecision: buildAllowedDecision(kind),
        page: result.session.page,
        evidence: result.evidence,
        startedAtMs,
        completedAtMs: Date.now(),
      }),
    );
  } catch (err) {
    return browserActionFailure(toolId, kind, sessionId, startedAtMs, err);
  }
}

async function handleClose(
  toolId: string,
  args: Record<string, unknown>,
  manager: BrowserSessionManager,
): Promise<Output> {
  const startedAtMs = Date.now();
  const sessionId = stringArg(args, 'sessionId');
  const session = await manager.close(sessionId);
  return resultEnvelope(
    toolId,
    buildResult({
      kind: 'close',
      sessionId,
      status: session ? 'succeeded' : 'failed',
      policyDecision: buildAllowedDecision('close'),
      page: session?.page,
      startedAtMs,
      completedAtMs: Date.now(),
      error: session
        ? undefined
        : { code: 'BROWSER_SESSION_UNAVAILABLE', message: 'Browser session is not active' },
    }),
  );
}

function unavailableSessionResult(
  toolId: string,
  kind: BrowserActionResult['kind'],
  sessionId: string,
  startedAtMs: number,
): Output {
  return resultEnvelope(
    toolId,
    buildResult({
      kind,
      sessionId,
      status: 'failed',
      policyDecision: buildAllowedDecision(kind),
      startedAtMs,
      completedAtMs: Date.now(),
      error: { code: 'BROWSER_SESSION_UNAVAILABLE', message: 'Browser session is not active' },
    }),
  );
}

function browserActionFailure(
  toolId: string,
  kind: BrowserActionResult['kind'],
  sessionId: string,
  startedAtMs: number,
  err: unknown,
): Output {
  const code = err instanceof BrowserTargetError ? err.code : 'BROWSER_ACTION_FAILED';
  return resultEnvelope(
    toolId,
    buildResult({
      kind,
      sessionId,
      status: 'failed',
      policyDecision: buildAllowedDecision(kind),
      startedAtMs,
      completedAtMs: Date.now(),
      error: { code, message: errorMessage(err) },
    }),
  );
}

export async function executeBrowserTool(
  toolId: string,
  args: Record<string, unknown>,
  options?: BrowserToolOptions,
): Promise<Output | null> {
  const manager = managerFromOptions(options);
  switch (toolId) {
    case BROWSER_TOOL_IDS.start:
      return handleStart(toolId, args, manager);
    case BROWSER_TOOL_IDS.navigate:
      return handleNavigate(toolId, args, manager);
    case BROWSER_TOOL_IDS.snapshot:
      return handleSnapshot(toolId, args, manager);
    case BROWSER_TOOL_IDS.screenshot:
      return handleScreenshot(toolId, args, manager);
    case BROWSER_TOOL_IDS.click:
      return handleClick(toolId, args, manager);
    case BROWSER_TOOL_IDS.type:
      return handleType(toolId, args, manager);
    case BROWSER_TOOL_IDS.press:
      return handlePress(toolId, args, manager);
    case BROWSER_TOOL_IDS.close:
      return handleClose(toolId, args, manager);
    default:
      return null;
  }
}
