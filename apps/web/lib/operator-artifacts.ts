import type { ToolTraceEvent } from '@/hooks/use-harness-chat';
import {
  summarizeBrowserToolResult,
  type BrowserToolArtifactPreview,
} from '@/lib/browser-tool-results';

export type OperatorArtifactKind = 'image' | 'text' | 'json' | 'download';

export type OperatorArtifactView = BrowserToolArtifactPreview & {
  viewKind: OperatorArtifactKind;
  sourceLabel?: string;
  sourceUrl?: string;
  statusLabel: string;
  viewerLabel: string;
};

function viewKind(mimeType: string): OperatorArtifactKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/json') return 'json';
  if (mimeType.startsWith('text/')) return 'text';
  return 'download';
}

function viewerLabel(kind: OperatorArtifactKind): string {
  if (kind === 'image') return 'Inspect image';
  if (kind === 'json') return 'Inspect JSON';
  if (kind === 'text') return 'Inspect text';
  return 'Download file';
}

function artifactStatus(artifact: BrowserToolArtifactPreview): string {
  if (!artifact.downloadHref) return 'Unavailable';
  if (artifact.truncated) return 'Truncated';
  return 'Ready';
}

export function artifactViewsFromEvents(events: readonly ToolTraceEvent[]): OperatorArtifactView[] {
  const seen = new Set<string>();
  const artifacts: OperatorArtifactView[] = [];
  for (const event of events) {
    if (event.type !== 'result') continue;
    const summary = summarizeBrowserToolResult(event.data);
    if (!summary) continue;
    for (const artifact of summary.artifacts) {
      if (seen.has(artifact.id)) continue;
      seen.add(artifact.id);
      const kind = viewKind(artifact.mimeType);
      artifacts.push({
        ...artifact,
        viewKind: kind,
        sourceLabel: summary.title,
        sourceUrl: summary.url,
        statusLabel: artifactStatus(artifact),
        viewerLabel: viewerLabel(kind),
      });
    }
  }
  return artifacts;
}
