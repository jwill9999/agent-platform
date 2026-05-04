import { z } from 'zod';
import { RiskTierSchema, type RiskTier } from './tool.js';

export const BrowserProviderSchema = z.enum(['playwright', 'mcp_adapter', 'custom']);
export type BrowserProvider = z.infer<typeof BrowserProviderSchema>;

export const BrowserActionKindSchema = z.enum([
  'start',
  'navigate',
  'snapshot',
  'screenshot',
  'click',
  'type',
  'press',
  'close',
]);
export type BrowserActionKind = z.infer<typeof BrowserActionKindSchema>;

export const BrowserActionRiskTierByKind = {
  start: 'medium',
  navigate: 'medium',
  snapshot: 'low',
  screenshot: 'low',
  click: 'high',
  type: 'high',
  press: 'high',
  close: 'medium',
} as const satisfies Record<BrowserActionKind, RiskTier>;

export function getBrowserActionRiskTier(kind: BrowserActionKind): RiskTier {
  return BrowserActionRiskTierByKind[kind];
}

export const BrowserSessionStatusSchema = z.enum([
  'starting',
  'active',
  'closing',
  'closed',
  'failed',
  'expired',
]);
export type BrowserSessionStatus = z.infer<typeof BrowserSessionStatusSchema>;

export const BrowserViewportSchema = z
  .object({
    width: z.number().int().positive().max(7680),
    height: z.number().int().positive().max(4320),
    deviceScaleFactor: z.number().positive().max(10).default(1),
    isMobile: z.boolean().default(false),
  })
  .strict();
export type BrowserViewport = z.infer<typeof BrowserViewportSchema>;

export const BrowserPageStateSchema = z
  .object({
    url: z.string().min(1),
    title: z.string().optional(),
    viewport: BrowserViewportSchema.optional(),
    loadedAtMs: z.number().int().nonnegative().optional(),
  })
  .strict();
export type BrowserPageState = z.infer<typeof BrowserPageStateSchema>;

export const BrowserSessionSchema = z
  .object({
    id: z.string().min(1),
    ownerSessionId: z.string().min(1).optional(),
    provider: BrowserProviderSchema.default('playwright'),
    status: BrowserSessionStatusSchema,
    page: BrowserPageStateSchema.optional(),
    policyProfileId: z.string().min(1).optional(),
    createdAtMs: z.number().int().nonnegative(),
    updatedAtMs: z.number().int().nonnegative(),
    expiresAtMs: z.number().int().nonnegative().optional(),
    lastActionAtMs: z.number().int().nonnegative().optional(),
    artifactCount: z.number().int().min(0).default(0),
  })
  .strict();
export type BrowserSession = z.infer<typeof BrowserSessionSchema>;

export const BrowserActionTargetSchema = z
  .object({
    selector: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
    placeholder: z.string().min(1).optional(),
    altText: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    testId: z.string().min(1).optional(),
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
  })
  .strict()
  .refine(
    (target) =>
      Boolean(
        target.selector ??
        target.role ??
        target.label ??
        target.text ??
        target.placeholder ??
        target.altText ??
        target.title ??
        target.testId,
      ) ||
      (typeof target.x === 'number' && typeof target.y === 'number'),
    'target must include selector, role, label, text, or x/y coordinates',
  );
export type BrowserActionTarget = z.infer<typeof BrowserActionTargetSchema>;

const BrowserActionBaseSchema = z
  .object({
    sessionId: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().max(120_000).default(30_000),
    requestedAtMs: z.number().int().nonnegative().optional(),
  })
  .strict();

export const BrowserStartActionSchema = BrowserActionBaseSchema.extend({
  kind: z.literal('start'),
  url: z.string().url().optional(),
  viewport: BrowserViewportSchema.optional(),
  policyProfileId: z.string().min(1).optional(),
}).strict();
export type BrowserStartAction = z.infer<typeof BrowserStartActionSchema>;

export const BrowserNavigateActionSchema = BrowserActionBaseSchema.extend({
  kind: z.literal('navigate'),
  sessionId: z.string().min(1),
  url: z.string().url(),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).default('load'),
}).strict();
export type BrowserNavigateAction = z.infer<typeof BrowserNavigateActionSchema>;

export const BrowserSnapshotActionSchema = BrowserActionBaseSchema.extend({
  kind: z.literal('snapshot'),
  sessionId: z.string().min(1),
  includeDomSummary: z.boolean().default(true),
  includeAccessibilityTree: z.boolean().default(true),
  maxBytes: z.number().int().positive().max(1_000_000).default(200_000),
}).strict();
export type BrowserSnapshotAction = z.infer<typeof BrowserSnapshotActionSchema>;

export const BrowserScreenshotActionSchema = BrowserActionBaseSchema.extend({
  kind: z.literal('screenshot'),
  sessionId: z.string().min(1),
  fullPage: z.boolean().default(false),
  selector: z.string().min(1).optional(),
  maxBytes: z.number().int().positive().max(10_000_000).default(2_000_000),
}).strict();
export type BrowserScreenshotAction = z.infer<typeof BrowserScreenshotActionSchema>;

export const BrowserClickActionSchema = BrowserActionBaseSchema.extend({
  kind: z.literal('click'),
  sessionId: z.string().min(1),
  target: BrowserActionTargetSchema,
  expectNavigation: z.boolean().default(false),
  submitLike: z.boolean().default(false),
}).strict();
export type BrowserClickAction = z.infer<typeof BrowserClickActionSchema>;

export const BrowserTypeActionSchema = BrowserActionBaseSchema.extend({
  kind: z.literal('type'),
  sessionId: z.string().min(1),
  target: BrowserActionTargetSchema,
  text: z.string(),
  clearExisting: z.boolean().default(false),
  sensitive: z.boolean().default(false),
}).strict();
export type BrowserTypeAction = z.infer<typeof BrowserTypeActionSchema>;

export const BrowserPressActionSchema = BrowserActionBaseSchema.extend({
  kind: z.literal('press'),
  sessionId: z.string().min(1),
  key: z.string().min(1),
  target: BrowserActionTargetSchema.optional(),
  submitLike: z.boolean().default(false),
}).strict();
export type BrowserPressAction = z.infer<typeof BrowserPressActionSchema>;

export const BrowserCloseActionSchema = BrowserActionBaseSchema.extend({
  kind: z.literal('close'),
  sessionId: z.string().min(1),
}).strict();
export type BrowserCloseAction = z.infer<typeof BrowserCloseActionSchema>;

export const BrowserActionRequestSchema = z.discriminatedUnion('kind', [
  BrowserStartActionSchema,
  BrowserNavigateActionSchema,
  BrowserSnapshotActionSchema,
  BrowserScreenshotActionSchema,
  BrowserClickActionSchema,
  BrowserTypeActionSchema,
  BrowserPressActionSchema,
  BrowserCloseActionSchema,
]);
export type BrowserActionRequest = z.infer<typeof BrowserActionRequestSchema>;

export const BrowserPolicyDecisionStateSchema = z.enum(['allowed', 'approval_required', 'denied']);
export type BrowserPolicyDecisionState = z.infer<typeof BrowserPolicyDecisionStateSchema>;

export const BrowserUrlPolicySchema = z
  .object({
    allowedProtocols: z.array(z.enum(['http', 'https'])).default(['http', 'https']),
    allowedDomains: z.array(z.string().min(1)).default([]),
    deniedDomains: z.array(z.string().min(1)).default([]),
    allowLocalhost: z.boolean().default(true),
    allowPrivateNetwork: z.boolean().default(false),
    requireApprovalForExternal: z.boolean().default(true),
    allowRedirects: z.boolean().default(true),
    maxRedirects: z.number().int().min(0).max(20).default(5),
  })
  .strict();
export type BrowserUrlPolicy = z.infer<typeof BrowserUrlPolicySchema>;

export const BrowserActionPolicySchema = z
  .object({
    approvalRequiredForRiskTiers: z.array(RiskTierSchema).default(['high', 'critical']),
    blockedActionKinds: z.array(BrowserActionKindSchema).default([]),
    requireApprovalForSubmitLikeActions: z.boolean().default(true),
    requireApprovalForCredentialEntry: z.boolean().default(true),
  })
  .strict();
export type BrowserActionPolicy = z.infer<typeof BrowserActionPolicySchema>;

export const BrowserEvidencePolicySchema = z
  .object({
    maxTextBytes: z.number().int().positive().max(2_000_000).default(200_000),
    maxScreenshotBytes: z.number().int().positive().max(20_000_000).default(2_000_000),
    maxTraceBytes: z.number().int().positive().max(10_000_000).default(1_000_000),
    redactSecrets: z.boolean().default(true),
    redactInputText: z.boolean().default(true),
    captureConsole: z.boolean().default(false),
    captureNetwork: z.boolean().default(false),
  })
  .strict();
export type BrowserEvidencePolicy = z.infer<typeof BrowserEvidencePolicySchema>;

export const BrowserPolicyProfileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    urlPolicy: BrowserUrlPolicySchema.default({}),
    actionPolicy: BrowserActionPolicySchema.default({}),
    evidencePolicy: BrowserEvidencePolicySchema.default({}),
    sessionTimeoutMs: z.number().int().positive().max(3_600_000).default(600_000),
    maxConcurrentSessions: z.number().int().positive().max(10).default(1),
  })
  .strict();
export type BrowserPolicyProfile = z.infer<typeof BrowserPolicyProfileSchema>;

export const DEFAULT_BROWSER_POLICY_PROFILE = BrowserPolicyProfileSchema.parse({
  id: 'default-browser-policy',
  name: 'Default browser policy',
});

export const BrowserPolicyDecisionSchema = z
  .object({
    state: BrowserPolicyDecisionStateSchema,
    riskTier: RiskTierSchema,
    reasons: z.array(z.string().min(1)).default([]),
    matchedRule: z.string().min(1).optional(),
  })
  .strict();
export type BrowserPolicyDecision = z.infer<typeof BrowserPolicyDecisionSchema>;

export const BrowserEvidenceKindSchema = z.enum([
  'screenshot',
  'aria_snapshot',
  'dom_summary',
  'console_summary',
  'network_summary',
  'trace',
  'page_metadata',
]);
export type BrowserEvidenceKind = z.infer<typeof BrowserEvidenceKindSchema>;

export const BrowserEvidenceStorageSchema = z.enum(['inline', 'workspace_file', 'database']);
export type BrowserEvidenceStorage = z.infer<typeof BrowserEvidenceStorageSchema>;

export const BrowserEvidenceRedactionSchema = z
  .object({
    secretsRedacted: z.boolean().default(false),
    inputTextRedacted: z.boolean().default(false),
    urlsRedacted: z.boolean().default(false),
    screenshotMasked: z.boolean().default(false),
  })
  .strict();
export type BrowserEvidenceRedaction = z.infer<typeof BrowserEvidenceRedactionSchema>;

const BrowserEvidenceArtifactBaseSchema = z
  .object({
    id: z.string().min(1),
    sessionId: z.string().min(1),
    actionId: z.string().min(1).optional(),
    kind: BrowserEvidenceKindSchema,
    storage: BrowserEvidenceStorageSchema,
    label: z.string().min(1),
    mimeType: z.string().min(1),
    uri: z.string().min(1).optional(),
    content: z.string().optional(),
    sizeBytes: z.number().int().min(0),
    maxBytes: z.number().int().positive(),
    truncated: z.boolean().default(false),
    redaction: BrowserEvidenceRedactionSchema.default({}),
    sha256: z.string().length(64).optional(),
    pageUrl: z.string().min(1).optional(),
    viewport: BrowserViewportSchema.optional(),
    capturedAtMs: z.number().int().nonnegative(),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict();

function validateArtifactBounds(
  artifact: { sizeBytes: number; maxBytes: number; truncated: boolean },
  ctx: z.RefinementCtx,
): void {
  if (artifact.sizeBytes > artifact.maxBytes && !artifact.truncated) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['truncated'],
      message: 'artifact must be marked truncated when sizeBytes exceeds maxBytes',
    });
  }
}

export const BrowserEvidenceArtifactSchema = BrowserEvidenceArtifactBaseSchema.superRefine(
  (artifact, ctx) => {
    if (artifact.sizeBytes > artifact.maxBytes && !artifact.truncated) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['truncated'],
        message: 'artifact must be marked truncated when sizeBytes exceeds maxBytes',
      });
    }
  },
);
export type BrowserEvidenceArtifact = z.infer<typeof BrowserEvidenceArtifactSchema>;

export const BrowserActionResultStatusSchema = z.enum([
  'succeeded',
  'failed',
  'denied',
  'approval_required',
  'timed_out',
]);
export type BrowserActionResultStatus = z.infer<typeof BrowserActionResultStatusSchema>;

export const BrowserToolErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  })
  .strict();
export type BrowserToolError = z.infer<typeof BrowserToolErrorSchema>;

export const BrowserActionResultSchema = z
  .object({
    id: z.string().min(1),
    kind: BrowserActionKindSchema,
    sessionId: z.string().min(1).optional(),
    status: BrowserActionResultStatusSchema,
    policyDecision: BrowserPolicyDecisionSchema,
    page: BrowserPageStateSchema.optional(),
    evidence: z.array(BrowserEvidenceArtifactSchema).default([]),
    startedAtMs: z.number().int().nonnegative(),
    completedAtMs: z.number().int().nonnegative().optional(),
    durationMs: z.number().int().nonnegative().optional(),
    error: BrowserToolErrorSchema.optional(),
  })
  .strict();
export type BrowserActionResult = z.infer<typeof BrowserActionResultSchema>;

export const BrowserArtifactSummarySchema = BrowserEvidenceArtifactBaseSchema.extend({
  path: z.string().min(1),
  downloadPath: z.string().min(1),
})
  .strict()
  .superRefine(validateArtifactBounds);
export type BrowserArtifactSummary = z.infer<typeof BrowserArtifactSummarySchema>;

export const BrowserArtifactSessionSummarySchema = z
  .object({
    sessionId: z.string().min(1),
    artifactCount: z.number().int().nonnegative(),
    latestCapturedAtMs: z.number().int().nonnegative().optional(),
    artifacts: z.array(BrowserArtifactSummarySchema),
  })
  .strict();
export type BrowserArtifactSessionSummary = z.infer<typeof BrowserArtifactSessionSummarySchema>;

export const BrowserArtifactsResponseSchema = z
  .object({
    totalArtifacts: z.number().int().nonnegative(),
    sessions: z.array(BrowserArtifactSessionSummarySchema),
  })
  .strict();
export type BrowserArtifactsResponse = z.infer<typeof BrowserArtifactsResponseSchema>;

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '0.0.0.0' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]' ||
    normalized === '::1'
  );
}

function domainMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  const rule = domain.toLowerCase();
  const normalizedRule = rule.startsWith('*.') ? rule.slice(2) : rule;
  return host === normalizedRule || host.endsWith(`.${normalizedRule}`);
}

export function evaluateBrowserUrlPolicy(
  url: string,
  profile: BrowserPolicyProfile = DEFAULT_BROWSER_POLICY_PROFILE,
): BrowserPolicyDecision {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return BrowserPolicyDecisionSchema.parse({
      state: 'denied',
      riskTier: 'medium',
      reasons: ['URL is invalid'],
      matchedRule: 'invalid_url',
    });
  }

  const protocol = parsed.protocol.replace(':', '') as 'http' | 'https';
  const policy = profile.urlPolicy;
  if (!policy.allowedProtocols.includes(protocol)) {
    return BrowserPolicyDecisionSchema.parse({
      state: 'denied',
      riskTier: 'medium',
      reasons: [`Protocol "${protocol}" is not allowed`],
      matchedRule: 'protocol_denied',
    });
  }

  if (policy.deniedDomains.some((domain) => domainMatches(parsed.hostname, domain))) {
    return BrowserPolicyDecisionSchema.parse({
      state: 'denied',
      riskTier: 'medium',
      reasons: [`Domain "${parsed.hostname}" is denied`],
      matchedRule: 'domain_denied',
    });
  }

  if (isLocalHostname(parsed.hostname) && policy.allowLocalhost) {
    return BrowserPolicyDecisionSchema.parse({
      state: 'allowed',
      riskTier: 'medium',
      reasons: ['Local development URL is allowed'],
      matchedRule: 'localhost_allowed',
    });
  }

  if (policy.allowedDomains.some((domain) => domainMatches(parsed.hostname, domain))) {
    return BrowserPolicyDecisionSchema.parse({
      state: 'allowed',
      riskTier: 'medium',
      reasons: [`Domain "${parsed.hostname}" matches the allowlist`],
      matchedRule: 'domain_allowed',
    });
  }

  return BrowserPolicyDecisionSchema.parse({
    state: policy.requireApprovalForExternal ? 'approval_required' : 'allowed',
    riskTier: 'medium',
    reasons: [`External domain "${parsed.hostname}" is not explicitly allowlisted`],
    matchedRule: policy.requireApprovalForExternal
      ? 'external_domain_requires_approval'
      : 'external_domain_allowed',
  });
}
