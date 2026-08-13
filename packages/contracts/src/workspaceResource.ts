import { z } from 'zod';

export const WorkspaceResourceKindSchema = z.enum([
  'file',
  'diff',
  'preview',
  'terminal',
  'webview',
]);
export type WorkspaceResourceKind = z.infer<typeof WorkspaceResourceKindSchema>;

export const WorkspaceResourceActionSchema = z.enum([
  'open',
  'preview',
  'reveal',
  'external_fallback',
]);
export type WorkspaceResourceAction = z.infer<typeof WorkspaceResourceActionSchema>;

const WORKSPACE_RESOURCE_URI_PATTERN =
  /^workspace:\/\/project\/([^/\s]+)\/(file|diff|preview|terminal|webview)\/(.+)$/;

export const WorkspaceResourceUriSchema = z
  .string()
  .refine(
    (value) => WORKSPACE_RESOURCE_URI_PATTERN.test(value),
    'Workspace resource URI must match workspace://project/<projectId>/<kind>/<target>',
  );
export type WorkspaceResourceUri = z.infer<typeof WorkspaceResourceUriSchema>;

export type ParsedWorkspaceResourceUri = {
  projectId: string;
  kind: WorkspaceResourceKind;
  target: string;
};

/**
 * Converts a container workspace path into the safe, project-relative form
 * carried by workspace-resource metadata. Host-absolute and traversal paths
 * are deliberately not representable in the resource contract.
 */
export function normalizeWorkspaceResourcePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\/workspace\/?/, '');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    return undefined;
  }
  return normalized;
}

export function parseWorkspaceResourceUri(uri: string): ParsedWorkspaceResourceUri {
  WorkspaceResourceUriSchema.parse(uri);
  const match = WORKSPACE_RESOURCE_URI_PATTERN.exec(uri);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error('Invalid workspace resource URI');
  }
  return {
    projectId: decodeURIComponent(match[1]),
    kind: WorkspaceResourceKindSchema.parse(match[2]),
    target: decodeURIComponent(match[3]),
  };
}

export function workspaceResourceUri(input: {
  projectId: string;
  kind: WorkspaceResourceKind;
  target: string;
}): WorkspaceResourceUri {
  const projectId = encodeURIComponent(input.projectId);
  const target = input.target
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return WorkspaceResourceUriSchema.parse(
    `workspace://project/${projectId}/${input.kind}/${target}`,
  );
}

export const WorkspaceResourceSchema = z.object({
  uri: WorkspaceResourceUriSchema,
  kind: WorkspaceResourceKindSchema,
  projectId: z.string().min(1),
  label: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});
export type WorkspaceResource = z.infer<typeof WorkspaceResourceSchema>;

export const WorkspaceResourceResolutionSchema = z.object({
  resource: WorkspaceResourceSchema,
  actions: z.array(WorkspaceResourceActionSchema).default(['open']),
  previewUrl: z.string().min(1).optional(),
  downloadUrl: z.string().min(1).optional(),
});
export type WorkspaceResourceResolution = z.infer<typeof WorkspaceResourceResolutionSchema>;

export const WorkspaceEventTypeSchema = z.enum([
  'resource_open_requested',
  'resource_created',
  'diff_created',
  'preview_available',
  'terminal_started',
  'webview_requested',
  'approval_requested',
  'tool_executed',
]);
export type WorkspaceEventType = z.infer<typeof WorkspaceEventTypeSchema>;

export const WorkspaceEventSchema = z.object({
  type: WorkspaceEventTypeSchema,
  resource: WorkspaceResourceSchema.optional(),
  action: WorkspaceResourceActionSchema.optional(),
  message: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type WorkspaceEvent = z.infer<typeof WorkspaceEventSchema>;

export type DesktopWebViewPolicyTier = 'local' | 'trusted' | 'external';
export type DesktopWebViewStatus = 'loading' | 'active' | 'blocked' | 'error' | 'closed';

export interface DesktopWorkspaceWebViewState {
  readonly webviewId: string;
  readonly projectId?: string;
  readonly url: string;
  readonly title?: string;
  readonly origin: string;
  readonly policyTier: DesktopWebViewPolicyTier;
  readonly status: DesktopWebViewStatus;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly externalFallbackUrl?: string;
  readonly blockedUrl?: string;
  readonly error?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly bounds?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export type DesktopWebViewState = DesktopWorkspaceWebViewState;

export type DesktopWorkspaceOpenResult =
  | {
      readonly ok: true;
      readonly handled: true;
      readonly webview: DesktopWorkspaceWebViewState;
    }
  | {
      readonly ok: true;
      readonly handled: false;
      readonly reason: string;
      readonly externalFallbackUrl?: string;
    };

export interface DesktopWorkspaceOpenExternalFallbackResult {
  readonly ok: true;
  readonly handled: true;
  readonly externalFallbackUrl: string;
}

export interface DesktopSelectedProjectFolder {
  readonly path: string;
  readonly name: string;
}

export interface DesktopCreateProjectFolderRequest {
  readonly name: string;
}

export interface DesktopOpenProjectIdeRequest {
  readonly projectId: string;
}

export type DesktopOpenProjectIdeResult =
  | {
      readonly ok: true;
      readonly handled: true;
      readonly projectRoot: string;
      readonly opener: string;
    }
  | {
      readonly ok: true;
      readonly handled: false;
      readonly reason: string;
    };

export type DesktopProjectFolderSelectionResult =
  | { readonly canceled: true }
  | { readonly canceled: false; readonly folder: DesktopSelectedProjectFolder };

export interface DesktopTerminalCreateRequest {
  readonly projectId?: string;
  readonly cols: number;
  readonly rows: number;
}

export interface DesktopTerminalCreateResult {
  readonly terminalId: string;
  readonly cwd: string;
  readonly shell: string;
  readonly pid: number;
}

export interface DesktopTerminalDataEvent {
  readonly terminalId: string;
  readonly data: string;
}

export interface DesktopTerminalExitEvent {
  readonly terminalId: string;
  readonly exitCode: number;
  readonly signal?: number;
}
