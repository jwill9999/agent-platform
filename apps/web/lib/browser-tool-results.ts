import { API_V1_PREFIX } from './apiClient';

export type BrowserToolArtifactPreview = {
  id: string;
  kind: string;
  label: string;
  mimeType: string;
  downloadHref?: string;
  previewHref?: string;
  truncated: boolean;
  sizeBytes: number;
};

export type BrowserToolResultSummary = {
  kind: string;
  status: string;
  url?: string;
  title?: string;
  policy?: string;
  error?: string;
  artifacts: BrowserToolArtifactPreview[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function artifactDownloadHref(artifact: Record<string, unknown>): string | undefined {
  const metadata = isRecord(artifact.metadata) ? artifact.metadata : {};
  const path = stringValue(metadata.workspaceRelativePath) ?? stringValue(artifact.downloadPath);
  return path
    ? `${API_V1_PREFIX}/browser/artifacts/download?path=${encodeURIComponent(path)}`
    : undefined;
}

function artifactPreviewHref(
  artifact: Record<string, unknown>,
  mimeType: string,
): string | undefined {
  if (!mimeType.startsWith('image/')) return undefined;
  const downloadHref = artifactDownloadHref(artifact);
  return downloadHref ? `${downloadHref}&disposition=inline` : undefined;
}

function summarizeArtifact(value: unknown): BrowserToolArtifactPreview | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const kind = stringValue(value.kind);
  const label = stringValue(value.label);
  const mimeType = stringValue(value.mimeType);
  const sizeBytes = numberValue(value.sizeBytes);
  if (!id || !kind || !label || !mimeType || sizeBytes === undefined) return null;
  return {
    id,
    kind,
    label,
    mimeType,
    downloadHref: artifactDownloadHref(value),
    previewHref: artifactPreviewHref(value, mimeType),
    truncated: value.truncated === true,
    sizeBytes,
  };
}

export function summarizeBrowserToolResult(data: unknown): BrowserToolResultSummary | null {
  if (!isRecord(data)) return null;
  const kind = stringValue(data.kind);
  const status = stringValue(data.status);
  if (!kind || !status) return null;
  const page = isRecord(data.page) ? data.page : {};
  const policyDecision = isRecord(data.policyDecision) ? data.policyDecision : {};
  const error = isRecord(data.error) ? data.error : {};
  const evidence = Array.isArray(data.evidence) ? data.evidence : [];
  return {
    kind,
    status,
    url: stringValue(page.url),
    title: stringValue(page.title),
    policy: stringValue(policyDecision.matchedRule),
    error: stringValue(error.message),
    artifacts: evidence
      .map(summarizeArtifact)
      .filter((item): item is BrowserToolArtifactPreview => Boolean(item)),
  };
}
