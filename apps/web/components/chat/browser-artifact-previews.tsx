'use client';

import { useMemo, useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

import type { ToolTraceEvent } from '@/hooks/use-harness-chat';
import {
  summarizeBrowserToolResult,
  type BrowserToolArtifactPreview,
} from '@/lib/browser-tool-results';
import { formatFileSize } from '@/lib/workspace-files';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type Props = Readonly<{
  events: readonly ToolTraceEvent[];
}>;

type PreviewArtifact = BrowserToolArtifactPreview & {
  pageTitle?: string;
  pageUrl?: string;
};

const MIN_ZOOM = 100;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;

function browserImageArtifacts(events: readonly ToolTraceEvent[]): PreviewArtifact[] {
  const seen = new Set<string>();
  const artifacts: PreviewArtifact[] = [];
  for (const event of events) {
    if (event.type !== 'result') continue;
    const summary = summarizeBrowserToolResult(event.data);
    if (!summary) continue;
    for (const artifact of summary.artifacts) {
      if (!artifact.previewHref || seen.has(artifact.id)) continue;
      seen.add(artifact.id);
      artifacts.push({
        ...artifact,
        pageTitle: summary.title,
        pageUrl: summary.url,
      });
    }
  }
  return artifacts;
}

export function BrowserArtifactPreviews({ events }: Props) {
  const artifacts = useMemo(() => browserImageArtifacts(events), [events]);
  const [selected, setSelected] = useState<PreviewArtifact | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);

  if (artifacts.length === 0) return null;

  const openArtifact = (artifact: PreviewArtifact) => {
    setSelected(artifact);
    setZoomPercent(100);
  };

  const zoomOut = () => setZoomPercent((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP));
  const zoomIn = () => setZoomPercent((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP));

  return (
    <>
      <div className="my-3 grid gap-3">
        {artifacts.map((artifact) => (
          <figure
            key={artifact.id}
            className="overflow-hidden rounded-md border border-border bg-background"
          >
            <button
              type="button"
              onClick={() => openArtifact(artifact)}
              className="block h-56 w-full cursor-zoom-in overflow-hidden bg-muted/30 text-left"
              aria-label={`Open ${artifact.label}`}
            >
              <img
                src={artifact.previewHref}
                alt={artifact.label}
                className="h-auto min-h-full w-full object-cover object-top"
              />
            </button>
            <figcaption className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{artifact.label}</span>
              <span>{formatFileSize(artifact.sizeBytes)}</span>
              {artifact.truncated && <span className="text-amber-700">truncated</span>}
              {artifact.pageUrl && <span className="min-w-0 break-all">{artifact.pageUrl}</span>}
            </figcaption>
          </figure>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="grid h-[92vh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border bg-background p-0 shadow-2xl sm:rounded-md">
          <DialogTitle className="sr-only">{selected?.label ?? 'Browser screenshot'}</DialogTitle>
          <DialogDescription className="sr-only">
            Use zoom controls and scroll to inspect the screenshot. Click outside the viewer or use
            the close button to return to the chat.
          </DialogDescription>
          {selected && (
            <>
              <div className="flex min-h-0 items-center gap-2 border-b bg-background/95 px-3 py-2 pr-12">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{selected.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatFileSize(selected.sizeBytes)}
                    {selected.truncated ? ' · truncated' : ''}
                    {selected.pageUrl ? ` · ${selected.pageUrl}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={zoomOut}
                  disabled={zoomPercent <= MIN_ZOOM}
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
                  {zoomPercent}%
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={zoomIn}
                  disabled={zoomPercent >= MAX_ZOOM}
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setZoomPercent(100)}
                  disabled={zoomPercent === 100}
                  aria-label="Reset zoom"
                  title="Reset zoom"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 overflow-auto bg-muted/40 p-4">
                <div
                  className="mx-auto min-w-full"
                  style={{ width: `${Math.max(100, zoomPercent)}%` }}
                >
                  <img
                    src={selected.previewHref}
                    alt={selected.label}
                    className="block h-auto w-full max-w-none rounded-sm bg-background shadow-sm"
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
