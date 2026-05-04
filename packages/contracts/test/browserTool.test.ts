import { describe, expect, it } from 'vitest';
import {
  BrowserActionRequestSchema,
  BrowserActionResultSchema,
  BrowserArtifactsResponseSchema,
  BrowserEvidenceArtifactSchema,
  BrowserEvidenceKindSchema,
  BrowserPolicyProfileSchema,
  BrowserSessionSchema,
  DEFAULT_BROWSER_POLICY_PROFILE,
  evaluateBrowserUrlPolicy,
  getBrowserActionRiskTier,
} from '../src/index.js';

describe('browser tool contracts', () => {
  it('classifies browser actions by risk tier', () => {
    expect(getBrowserActionRiskTier('snapshot')).toBe('low');
    expect(getBrowserActionRiskTier('screenshot')).toBe('low');
    expect(getBrowserActionRiskTier('start')).toBe('medium');
    expect(getBrowserActionRiskTier('navigate')).toBe('medium');
    expect(getBrowserActionRiskTier('close')).toBe('medium');
    expect(getBrowserActionRiskTier('click')).toBe('high');
    expect(getBrowserActionRiskTier('type')).toBe('high');
    expect(getBrowserActionRiskTier('press')).toBe('high');
  });

  it('round-trips a browser session and read-only actions', () => {
    const session = BrowserSessionSchema.parse({
      id: 'browser-session-1',
      ownerSessionId: 'chat-session-1',
      status: 'active',
      page: {
        url: 'http://localhost:3001',
        title: 'Agent Platform',
        viewport: { width: 1280, height: 720 },
        loadedAtMs: 1_000,
      },
      createdAtMs: 1_000,
      updatedAtMs: 1_100,
    });

    const snapshot = BrowserActionRequestSchema.parse({
      kind: 'snapshot',
      sessionId: session.id,
    });
    const screenshot = BrowserActionRequestSchema.parse({
      kind: 'screenshot',
      sessionId: session.id,
      fullPage: true,
    });

    expect(BrowserSessionSchema.parse(structuredClone(session))).toEqual(session);
    expect(snapshot).toMatchObject({
      kind: 'snapshot',
      includeDomSummary: true,
      includeAccessibilityTree: true,
      maxBytes: 200_000,
    });
    expect(screenshot).toMatchObject({
      kind: 'screenshot',
      fullPage: true,
      maxBytes: 2_000_000,
    });
  });

  it('validates navigation and input action shapes', () => {
    expect(
      BrowserActionRequestSchema.parse({
        kind: 'navigate',
        sessionId: 'browser-session-1',
        url: 'https://example.com/app',
      }),
    ).toMatchObject({ kind: 'navigate', waitUntil: 'load' });

    expect(
      BrowserActionRequestSchema.parse({
        kind: 'click',
        sessionId: 'browser-session-1',
        target: { role: 'button', label: 'Submit', testId: 'submit-button' },
        submitLike: true,
      }),
    ).toMatchObject({ kind: 'click', submitLike: true, target: { testId: 'submit-button' } });

    expect(
      BrowserActionRequestSchema.parse({
        kind: 'type',
        sessionId: 'browser-session-1',
        target: { placeholder: 'Search', title: 'Site search', altText: 'Search icon' },
        text: 'browser tools',
      }),
    ).toMatchObject({ kind: 'type', target: { placeholder: 'Search' } });

    expect(() =>
      BrowserActionRequestSchema.parse({
        kind: 'click',
        sessionId: 'browser-session-1',
        target: {},
      }),
    ).toThrow();
  });

  it('applies local and external URL policy defaults', () => {
    expect(evaluateBrowserUrlPolicy('http://localhost:3001')).toMatchObject({
      state: 'allowed',
      riskTier: 'medium',
      matchedRule: 'localhost_allowed',
    });

    expect(evaluateBrowserUrlPolicy('http://web:3001')).toMatchObject({
      state: 'allowed',
      riskTier: 'medium',
      matchedRule: 'domain_allowed',
    });

    expect(evaluateBrowserUrlPolicy('https://example.com')).toMatchObject({
      state: 'approval_required',
      riskTier: 'medium',
      matchedRule: 'external_domain_requires_approval',
    });

    expect(evaluateBrowserUrlPolicy('file:///etc/passwd')).toMatchObject({
      state: 'denied',
      matchedRule: 'protocol_denied',
    });
  });

  it('supports domain allow and deny policies', () => {
    const profile = BrowserPolicyProfileSchema.parse({
      ...DEFAULT_BROWSER_POLICY_PROFILE,
      urlPolicy: {
        allowedDomains: ['example.com'],
        deniedDomains: ['danger.example.com'],
      },
    });

    expect(evaluateBrowserUrlPolicy('https://app.example.com/dashboard', profile)).toMatchObject({
      state: 'allowed',
      matchedRule: 'domain_allowed',
    });
    expect(evaluateBrowserUrlPolicy('https://danger.example.com/delete', profile)).toMatchObject({
      state: 'denied',
      matchedRule: 'domain_denied',
    });
  });

  it('bounds evidence artifacts and records redaction flags', () => {
    const artifact = BrowserEvidenceArtifactSchema.parse({
      id: 'artifact-1',
      sessionId: 'browser-session-1',
      actionId: 'action-1',
      kind: 'screenshot',
      storage: 'workspace_file',
      label: 'Screenshot',
      mimeType: 'image/png',
      uri: '/workspace/.agent-platform/browser/artifact-1.png',
      sizeBytes: 2_500_000,
      maxBytes: 2_000_000,
      truncated: true,
      redaction: {
        secretsRedacted: true,
        inputTextRedacted: true,
        screenshotMasked: true,
      },
      capturedAtMs: 1_500,
      pageUrl: 'https://example.com/form',
      viewport: { width: 1440, height: 900 },
    });

    expect(artifact.redaction.secretsRedacted).toBe(true);
    expect(artifact.truncated).toBe(true);
    expect(() =>
      BrowserEvidenceArtifactSchema.parse({
        ...artifact,
        id: 'artifact-2',
        truncated: false,
      }),
    ).toThrow();
  });

  it('rejects unsupported browser evidence types', () => {
    expect(() => BrowserEvidenceKindSchema.parse('video')).toThrow();
    expect(() => BrowserEvidenceKindSchema.parse('raw_har')).toThrow();
  });

  it('represents a governed browser action result with evidence', () => {
    const result = BrowserActionResultSchema.parse({
      id: 'action-1',
      kind: 'snapshot',
      sessionId: 'browser-session-1',
      status: 'succeeded',
      policyDecision: {
        state: 'allowed',
        riskTier: 'low',
        reasons: ['Read-only inspection is allowed'],
      },
      page: {
        url: 'http://localhost:3001',
        title: 'Agent Platform',
      },
      evidence: [
        {
          id: 'artifact-1',
          sessionId: 'browser-session-1',
          actionId: 'action-1',
          kind: 'aria_snapshot',
          storage: 'inline',
          label: 'Accessibility snapshot',
          mimeType: 'application/json',
          content: '{"role":"main"}',
          sizeBytes: 15,
          maxBytes: 200_000,
          capturedAtMs: 2_000,
        },
      ],
      startedAtMs: 1_900,
      completedAtMs: 2_000,
      durationMs: 100,
    });

    expect(BrowserActionResultSchema.parse(structuredClone(result))).toEqual(result);
    expect(result.evidence[0]?.kind).toBe('aria_snapshot');
  });

  it('represents browser artifact listings grouped by session', () => {
    const listing = BrowserArtifactsResponseSchema.parse({
      totalArtifacts: 1,
      sessions: [
        {
          sessionId: 'browser-session-1',
          artifactCount: 1,
          latestCapturedAtMs: 2_000,
          artifacts: [
            {
              id: 'artifact-1',
              sessionId: 'browser-session-1',
              kind: 'screenshot',
              storage: 'workspace_file',
              label: 'Browser screenshot',
              mimeType: 'image/png',
              uri: '/workspace/.agent-platform/browser/browser-session-1/artifact-1.png',
              path: '.agent-platform/browser/browser-session-1/artifact-1.png',
              downloadPath: '.agent-platform/browser/browser-session-1/artifact-1.png',
              sizeBytes: 1024,
              maxBytes: 2_000_000,
              capturedAtMs: 2_000,
            },
          ],
        },
      ],
    });

    expect(listing.sessions[0]?.artifacts[0]?.downloadPath).toContain('.agent-platform/browser');
  });
});
