'use client';

import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe,
  Maximize2,
  Minimize2,
  PanelRightClose,
  RefreshCw,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  getDesktopWorkspaceBridge,
  hasDesktopWorkspaceWebViewBridge,
  type DesktopWorkspaceWebViewState,
} from '@/lib/desktop-workspace';

export type ProjectWebViewMode = 'docked' | 'wide' | 'overlay';

type ProjectWebViewPanelProps = Readonly<{
  projectId: string | null;
  viewMode?: ProjectWebViewMode;
  onViewModeChange?: (mode: ProjectWebViewMode) => void;
}>;

function webviewStatusLabel(webview: DesktopWorkspaceWebViewState | null): string {
  if (!webview) return 'No preview open';
  if (webview.status === 'loading') return 'Loading';
  if (webview.status === 'blocked') return 'Blocked';
  if (webview.status === 'error') return 'Error';
  if (webview.status === 'closed') return 'Closed';
  return webview.policyTier === 'local'
    ? 'Local preview'
    : webview.policyTier === 'trusted'
      ? 'Trusted'
      : 'External';
}

function upsertWebView(
  webviews: readonly DesktopWorkspaceWebViewState[],
  next: DesktopWorkspaceWebViewState,
): readonly DesktopWorkspaceWebViewState[] {
  const existing = webviews.findIndex((webview) => webview.webviewId === next.webviewId);
  if (existing === -1) return [next, ...webviews];
  return webviews.map((webview) => (webview.webviewId === next.webviewId ? next : webview));
}

export function ProjectWebViewPanel({
  projectId,
  viewMode = 'docked',
  onViewModeChange,
}: ProjectWebViewPanelProps) {
  const [open, setOpen] = useState(true);
  const [webviews, setWebViews] = useState<readonly DesktopWorkspaceWebViewState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const dockedViewportRef = useRef<HTMLDivElement | null>(null);
  const overlayViewportRef = useRef<HTMLDivElement | null>(null);

  const activeWebView = useMemo(
    () => webviews.find((webview) => webview.webviewId === activeId) ?? webviews[0] ?? null,
    [activeId, webviews],
  );

  useEffect(() => {
    const bridge = getDesktopWorkspaceBridge();
    setBridgeAvailable(hasDesktopWorkspaceWebViewBridge());
    if (!bridge?.listWebViews || !bridge.onWebViewUpdated) return undefined;

    let disposed = false;
    bridge
      .listWebViews()
      .then((next) => {
        if (disposed) return;
        const filtered = projectId
          ? next.filter((webview) => !webview.projectId || webview.projectId === projectId)
          : next;
        const live = filtered.filter((webview) => webview.status !== 'closed');
        setWebViews(live);
        setActiveId((current) => current ?? live[0]?.webviewId ?? null);
      })
      .catch(() => {});

    const unsubscribe = bridge.onWebViewUpdated((event) => {
      if (projectId && event.projectId && event.projectId !== projectId) return;
      setWebViews((current) =>
        event.status === 'closed'
          ? current.filter((webview) => webview.webviewId !== event.webviewId)
          : upsertWebView(current, event),
      );
      if (event.status !== 'closed') {
        setOpen(true);
        setActiveId(event.webviewId);
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [projectId]);

  const updateBounds = useCallback(() => {
    const bridge = getDesktopWorkspaceBridge();
    if (!bridge?.setWebViewBounds || !activeWebView) return;
    const element = viewMode === 'overlay' ? overlayViewportRef.current : dockedViewportRef.current;
    const rect = element?.getBoundingClientRect();
    if (!rect || !open || activeWebView.status === 'closed') {
      void bridge.setWebViewBounds({
        webviewId: activeWebView.webviewId,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
      });
      return;
    }
    void bridge.setWebViewBounds({
      webviewId: activeWebView.webviewId,
      bounds: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
    });
  }, [activeWebView, open, viewMode]);

  useEffect(() => {
    updateBounds();
    const element = viewMode === 'overlay' ? overlayViewportRef.current : dockedViewportRef.current;
    const observer = element ? new ResizeObserver(updateBounds) : null;
    if (element) observer?.observe(element);
    window.addEventListener('resize', updateBounds);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateBounds);
      if (activeWebView) {
        void getDesktopWorkspaceBridge()?.setWebViewBounds?.({
          webviewId: activeWebView.webviewId,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
        });
      }
    };
  }, [activeWebView, updateBounds, viewMode]);

  useEffect(() => {
    if (viewMode !== 'overlay') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onViewModeChange?.('docked');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onViewModeChange, viewMode]);

  useEffect(() => {
    if (webviews.length === 0 && viewMode !== 'docked') {
      onViewModeChange?.('docked');
    }
  }, [onViewModeChange, viewMode, webviews.length]);

  const runWebViewAction = useCallback(
    (action: 'back' | 'forward' | 'reload' | 'close') => {
      const bridge = getDesktopWorkspaceBridge();
      if (!bridge || !activeWebView) return;
      const request = { webviewId: activeWebView.webviewId };
      if (action === 'back') void bridge.goBackWebView?.(request);
      if (action === 'forward') void bridge.goForwardWebView?.(request);
      if (action === 'reload') void bridge.reloadWebView?.(request);
      if (action === 'close') void bridge.closeWebView?.(request);
    },
    [activeWebView],
  );

  const openExternal = useCallback(() => {
    if (!activeWebView) return;
    const url = activeWebView.externalFallbackUrl ?? activeWebView.url;
    const bridge = getDesktopWorkspaceBridge();
    if (bridge?.openExternalFallback) {
      void bridge.openExternalFallback({ url });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [activeWebView]);

  if (!bridgeAvailable || (!activeWebView && webviews.length === 0)) {
    return null;
  }

  return (
    <>
      <aside
        className={cn(
          'hidden h-full max-h-full min-h-0 shrink-0 overflow-hidden border-l border-border bg-background/95 lg:flex',
          !open && 'w-12',
          open && viewMode === 'wide' && 'w-[min(980px,70vw)] min-w-[640px]',
          open && viewMode !== 'wide' && 'w-[min(640px,46vw)] min-w-[480px] max-w-[900px]',
        )}
        aria-label="Workspace preview"
        data-testid="project-webview-panel"
      >
        {!open ? (
          <button
            type="button"
            className="flex h-full w-full flex-col items-center gap-3 px-2 py-4 text-xs text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            onClick={() => setOpen(true)}
            aria-label="Open workspace preview panel"
            title="Open workspace preview panel"
          >
            <Globe className="h-5 w-5" />
            <span className="[writing-mode:vertical-rl] rotate-180 font-medium tracking-wide">
              Preview
            </span>
          </button>
        ) : (
          <PreviewChrome
            activeWebView={activeWebView}
            bridgeAvailable={bridgeAvailable}
            onClosePreview={() => runWebViewAction('close')}
            onCollapse={() => setOpen(false)}
            onDock={() => onViewModeChange?.('docked')}
            onNavigate={runWebViewAction}
            onOpenExternal={openExternal}
            onOverlay={() => onViewModeChange?.('overlay')}
            onWide={() => onViewModeChange?.(viewMode === 'wide' ? 'docked' : 'wide')}
            title="Workspace Preview"
            viewMode={viewMode}
            viewportRef={dockedViewportRef}
            webviews={webviews}
            setActiveId={setActiveId}
          />
        )}
      </aside>

      {viewMode === 'overlay' && (
        <div
          className="fixed inset-0 z-50 hidden bg-background/80 p-6 backdrop-blur-sm lg:block"
          role="dialog"
          aria-modal="true"
          aria-label="Focused workspace preview"
        >
          <div className="mx-auto flex h-full max-w-[1500px] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
            <PreviewChrome
              activeWebView={activeWebView}
              bridgeAvailable={bridgeAvailable}
              onClosePreview={() => runWebViewAction('close')}
              onCollapse={() => onViewModeChange?.('docked')}
              onDock={() => onViewModeChange?.('docked')}
              onNavigate={runWebViewAction}
              onOpenExternal={openExternal}
              onOverlay={() => onViewModeChange?.('docked')}
              onWide={() => onViewModeChange?.('wide')}
              title="Focused Preview"
              viewMode={viewMode}
              viewportRef={overlayViewportRef}
              webviews={webviews}
              setActiveId={setActiveId}
            />
          </div>
        </div>
      )}
    </>
  );
}

function PreviewChrome({
  activeWebView,
  bridgeAvailable,
  onClosePreview,
  onCollapse,
  onDock,
  onNavigate,
  onOpenExternal,
  onOverlay,
  onWide,
  setActiveId,
  title,
  viewMode,
  viewportRef,
  webviews,
}: Readonly<{
  activeWebView: DesktopWorkspaceWebViewState | null;
  bridgeAvailable: boolean;
  onClosePreview: () => void;
  onCollapse: () => void;
  onDock: () => void;
  onNavigate: (action: 'back' | 'forward' | 'reload' | 'close') => void;
  onOpenExternal: () => void;
  onOverlay: () => void;
  onWide: () => void;
  setActiveId: (id: string) => void;
  title: string;
  viewMode: ProjectWebViewMode;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  webviews: readonly DesktopWorkspaceWebViewState[];
}>) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
        <Globe className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {activeWebView?.title ?? activeWebView?.url ?? webviewStatusLabel(activeWebView)}
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onWide}
          title={viewMode === 'wide' ? 'Return to docked preview' : 'Use wide preview'}
        >
          {viewMode === 'wide' ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={viewMode === 'overlay' ? onDock : onOverlay}
          title={viewMode === 'overlay' ? 'Return to docked preview' : 'Focus preview'}
        >
          {viewMode === 'overlay' ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onCollapse}
          title={viewMode === 'overlay' ? 'Close focused preview' : 'Collapse preview panel'}
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={!activeWebView?.canGoBack}
          onClick={() => onNavigate('back')}
          title="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={!activeWebView?.canGoForward}
          onClick={() => onNavigate('forward')}
          title="Forward"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={!activeWebView}
          onClick={() => onNavigate('reload')}
          title="Reload"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1 truncate px-2 text-xs text-muted-foreground">
          {webviewStatusLabel(activeWebView)}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={!activeWebView}
          onClick={onOpenExternal}
          title="Open externally"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={!activeWebView}
          onClick={onClosePreview}
          title="Close preview"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {webviews.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-2">
          {webviews.map((webview) => (
            <button
              key={webview.webviewId}
              type="button"
              className={cn(
                'max-w-40 truncate rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground',
                webview.webviewId === activeWebView?.webviewId && 'bg-secondary text-foreground',
              )}
              onClick={() => {
                setActiveId(webview.webviewId);
                void getDesktopWorkspaceBridge()?.focusWebView?.({
                  webviewId: webview.webviewId,
                });
              }}
            >
              {webview.title ?? new URL(webview.url).hostname}
            </button>
          ))}
        </div>
      )}

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 bg-zinc-950"
        data-testid="project-webview-viewport"
      >
        {!bridgeAvailable ? (
          <PanelMessage
            title="Desktop preview unavailable"
            description="Embedded previews are available in the desktop shell. Browser mode opens preview resources externally."
          />
        ) : !activeWebView ? (
          <PanelMessage
            title="No preview open"
            description="Open a preview or web resource from Project Chat to show it here."
          />
        ) : activeWebView.status === 'blocked' || activeWebView.status === 'error' ? (
          <PanelMessage
            title={activeWebView.status === 'blocked' ? 'Navigation blocked' : 'Preview error'}
            description={activeWebView.error ?? activeWebView.blockedUrl ?? activeWebView.url}
            actionLabel={activeWebView.externalFallbackUrl ? 'Open externally' : undefined}
            onAction={activeWebView.externalFallbackUrl ? onOpenExternal : undefined}
          />
        ) : activeWebView.status === 'loading' ? (
          <PanelMessage title="Loading preview" description={activeWebView.url} />
        ) : null}
      </div>
    </div>
  );
}

function PanelMessage({
  title,
  description,
  actionLabel,
  onAction,
}: Readonly<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}>) {
  return (
    <div className="absolute inset-0 grid place-items-center p-5 text-center">
      <div className="max-w-xs">
        <div className="text-sm font-medium text-zinc-100">{title}</div>
        <div className="mt-2 break-words text-xs leading-5 text-zinc-400">{description}</div>
        {actionLabel && onAction ? (
          <Button type="button" size="sm" className="mt-4" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
