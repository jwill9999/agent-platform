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

type ViewMode = 'page' | 'width' | 'zoom';

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

function getZoomLabel(viewMode: ViewMode, zoomPercent: number): string {
  if (viewMode === 'page') return 'Fit';
  if (viewMode === 'width') return 'Width';
  return `${zoomPercent}%`;
}

export function BrowserArtifactPreviews({ events }: Props) {
  const artifacts = useMemo(() => browserImageArtifacts(events), [events]);
  const [selected, setSelected] = useState<PreviewArtifact | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('page');
  const [zoomPercent, setZoomPercent] = useState(100);

  if (artifacts.length === 0) return null;

  const openArtifact = (artifact: PreviewArtifact) => {
    setSelected(artifact);
    setViewMode('page');
    setZoomPercent(100);
  };

  const zoomOut = () => {
    setViewMode('zoom');
    setZoomPercent((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP));
  };
  const zoomIn = () => {
    setViewMode('zoom');
    setZoomPercent((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP));
  };
  const showFitPage = () => {
    setViewMode('page');
    setZoomPercent(100);
  };
  const showFitWidth = () => {
    setViewMode('width');
    setZoomPercent(100);
  };

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
              className="block max-h-[420px] w-full cursor-zoom-in overflow-auto bg-muted/30 text-left"
              aria-label={`Open ${artifact.label}`}
            >
              <img
                src={artifact.previewHref}
                alt={artifact.label}
                className="block h-auto w-full"
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
                  variant={viewMode === 'page' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={showFitPage}
                >
                  Fit page
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'width' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={showFitWidth}
                >
                  Fit width
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={zoomOut}
                  disabled={viewMode === 'page' || zoomPercent <= MIN_ZOOM}
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
                  {getZoomLabel(viewMode, zoomPercent)}
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
                  onClick={showFitPage}
                  disabled={viewMode === 'page'}
                  aria-label="Reset zoom"
                  title="Fit page"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              {viewMode === 'page' ? (
                <div className="flex min-h-0 items-start justify-center overflow-auto bg-muted/40 p-4">
                  <img
                    src={selected.previewHref}
                    alt={selected.label}
                    className="block max-h-full max-w-full rounded-sm bg-background object-contain shadow-sm"
                  />
                </div>
              ) : (
                <div className="min-h-0 overflow-auto bg-muted/40 p-4">
                  <div
                    className="mx-auto min-w-full"
                    style={{ width: `${viewMode === 'width' ? 100 : zoomPercent}%` }}
                  >
                    <img
                      src={selected.previewHref}
                      alt={selected.label}
                      className="block h-auto w-full max-w-none rounded-sm bg-background shadow-sm"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
