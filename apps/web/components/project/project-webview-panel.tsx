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

function runBridgeAction(action: Promise<unknown> | undefined): void {
  action?.catch(() => {});
}

function webviewStatusLabel(webview: DesktopWorkspaceWebViewState | null): string {
  if (!webview) return 'No preview open';
  if (webview.status === 'loading') return 'Loading';
  if (webview.status === 'blocked') return 'Blocked';
  if (webview.status === 'error') return 'Error';
  if (webview.status === 'closed') return 'Closed';
  if (webview.policyTier === 'local') return 'Local preview';
  if (webview.policyTier === 'trusted') return 'Trusted';
  return 'External';
}

function upsertWebView(
  webviews: readonly DesktopWorkspaceWebViewState[],
  next: DesktopWorkspaceWebViewState,
): readonly DesktopWorkspaceWebViewState[] {
  const existing = webviews.findIndex((webview) => webview.webviewId === next.webviewId);
  if (existing === -1) return [next, ...webviews];
  return webviews.map((webview) => (webview.webviewId === next.webviewId ? next : webview));
}

function updateWebViewsForEvent(
  webviews: readonly DesktopWorkspaceWebViewState[],
  event: DesktopWorkspaceWebViewState,
): readonly DesktopWorkspaceWebViewState[] {
  if (event.status === 'closed') {
    return webviews.filter((webview) => webview.webviewId !== event.webviewId);
  }
  return upsertWebView(webviews, event);
}

function previewModeTitle(viewMode: ProjectWebViewMode, mode: 'wide' | 'overlay'): string {
  if (mode === 'wide') {
    if (viewMode === 'wide') return 'Return preview to standard side width';
    return 'Make the side preview wider';
  }
  if (viewMode === 'overlay') return 'Return focused preview to the side panel';
  return 'Open preview in a focused overlay';
}

function panelMessageProps(
  activeWebView: DesktopWorkspaceWebViewState | null,
  onOpenExternal: () => void,
): Readonly<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> | null {
  if (activeWebView == null) {
    return {
      title: 'No preview open',
      description: 'Open a preview or web resource from Project Chat to show it here.',
    };
  }
  if (activeWebView.status === 'blocked' || activeWebView.status === 'error') {
    const hasExternalFallback = activeWebView.externalFallbackUrl != null;
    return {
      title: activeWebView.status === 'blocked' ? 'Navigation blocked' : 'Preview error',
      description: activeWebView.error ?? activeWebView.blockedUrl ?? activeWebView.url,
      actionLabel: hasExternalFallback ? 'Open externally' : undefined,
      onAction: hasExternalFallback ? onOpenExternal : undefined,
    };
  }
  if (activeWebView.status === 'loading') {
    return { title: 'Loading preview', description: activeWebView.url };
  }
  return null;
}

export function ProjectWebViewPanel({
  projectId,
  viewMode = 'docked',
  onViewModeChange,
}: ProjectWebViewPanelProps) {
  const [open, setOpen] = useState(true);
  const [webviews, setWebviews] = useState<readonly DesktopWorkspaceWebViewState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const dockedViewportRef = useRef<HTMLDivElement | null>(null);
  const overlayViewportRef = useRef<HTMLDivElement | null>(null);
  const lastBoundsKeyRef = useRef<string | null>(null);

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
        setWebviews(live);
        setActiveId((current) => current ?? live[0]?.webviewId ?? null);
      })
      .catch(() => {});

    const unsubscribe = bridge.onWebViewUpdated((event) => {
      if (projectId && event.projectId && event.projectId !== projectId) return;
      setWebviews((current) => updateWebViewsForEvent(current, event));
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
    const nextBounds =
      !rect || !open || activeWebView.status === 'closed'
        ? { x: 0, y: 0, width: 0, height: 0 }
        : {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
    const nextBoundsKey = `${activeWebView.webviewId}:${nextBounds.x}:${nextBounds.y}:${nextBounds.width}:${nextBounds.height}`;
    if (lastBoundsKeyRef.current === nextBoundsKey) return;
    lastBoundsKeyRef.current = nextBoundsKey;
    runBridgeAction(
      bridge.setWebViewBounds({
        webviewId: activeWebView.webviewId,
        bounds: nextBounds,
      }),
    );
  }, [activeWebView, open, viewMode]);

  const resetBounds = useCallback(() => {
    const bridge = getDesktopWorkspaceBridge();
    if (!bridge?.setWebViewBounds || !activeWebView) return;
    lastBoundsKeyRef.current = null;
    runBridgeAction(
      bridge.setWebViewBounds({
        webviewId: activeWebView.webviewId,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
      }),
    );
  }, [activeWebView]);

  useEffect(() => {
    lastBoundsKeyRef.current = null;
  }, [activeWebView?.webviewId, viewMode]);

  useEffect(() => {
    if (!activeWebView) return undefined;

    updateBounds();
    const element = viewMode === 'overlay' ? overlayViewportRef.current : dockedViewportRef.current;
    const observer = element ? new ResizeObserver(updateBounds) : null;
    let animationFrame = 0;
    const syncBounds = () => {
      updateBounds();
      animationFrame = globalThis.requestAnimationFrame(syncBounds);
    };

    animationFrame = globalThis.requestAnimationFrame(syncBounds);
    if (element) observer?.observe(element);
    globalThis.addEventListener('resize', updateBounds);

    return () => {
      globalThis.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      globalThis.removeEventListener('resize', updateBounds);
      resetBounds();
    };
  }, [activeWebView, resetBounds, updateBounds, viewMode]);

  useEffect(() => {
    if (viewMode !== 'overlay') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onViewModeChange?.('docked');
      }
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
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
      if (action === 'back') runBridgeAction(bridge.goBackWebView?.(request));
      if (action === 'forward') runBridgeAction(bridge.goForwardWebView?.(request));
      if (action === 'reload') runBridgeAction(bridge.reloadWebView?.(request));
      if (action === 'close') runBridgeAction(bridge.closeWebView?.(request));
    },
    [activeWebView],
  );

  const openExternal = useCallback(() => {
    if (activeWebView != null) {
      const url = activeWebView.externalFallbackUrl ?? activeWebView.url;
      const bridge = getDesktopWorkspaceBridge();
      if (bridge?.openExternalFallback) {
        runBridgeAction(bridge.openExternalFallback({ url }));
        return;
      }
      globalThis.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [activeWebView]);

  if (!bridgeAvailable || (!activeWebView && webviews.length === 0)) {
    return null;
  }

  return (
    <>
      <aside
        className={cn(
          'hidden h-full max-h-full min-h-0 min-w-0 shrink-0 overflow-hidden border-l border-border bg-background/95 lg:flex',
          open ? null : 'w-12',
          open && viewMode === 'wide' && 'w-[clamp(520px,62vw,980px)]',
          open && viewMode !== 'wide' && 'w-[clamp(360px,38vw,640px)] max-w-[900px]',
        )}
        aria-label="Workspace preview"
        data-testid="project-webview-panel"
      >
        {open ? (
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
        ) : (
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
        )}
      </aside>

      {viewMode === 'overlay' && (
        <dialog
          open
          className="fixed inset-0 z-50 hidden h-auto w-auto max-h-none max-w-none border-0 bg-background/80 p-6 backdrop-blur-sm lg:block"
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
        </dialog>
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
  const activeWebViewMissing = activeWebView == null;

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
        <PreviewModeControls
          onDock={onDock}
          onOverlay={onOverlay}
          onWide={onWide}
          viewMode={viewMode}
        />
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
          disabled={activeWebView?.canGoBack !== true}
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
          disabled={activeWebView?.canGoForward !== true}
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
          disabled={activeWebViewMissing}
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
          disabled={activeWebViewMissing}
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
          disabled={activeWebViewMissing}
          onClick={onClosePreview}
          title="Close preview"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <WebViewTabs activeWebView={activeWebView} setActiveId={setActiveId} webviews={webviews} />

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 bg-zinc-950"
        data-testid="project-webview-viewport"
      >
        <PreviewViewportMessage
          activeWebView={activeWebView}
          bridgeAvailable={bridgeAvailable}
          onOpenExternal={onOpenExternal}
        />
      </div>
    </div>
  );
}

function PreviewModeControls({
  onDock,
  onOverlay,
  onWide,
  viewMode,
}: Readonly<{
  onDock: () => void;
  onOverlay: () => void;
  onWide: () => void;
  viewMode: ProjectWebViewMode;
}>) {
  const isWide = viewMode === 'wide';
  const isOverlay = viewMode === 'overlay';
  const WideIcon = isWide ? Minimize2 : Maximize2;
  const FocusIcon = isOverlay ? Minimize2 : Maximize2;

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted/30 p-1">
      <Button
        type="button"
        size="sm"
        variant={isWide ? 'secondary' : 'ghost'}
        className="h-7 gap-1.5 px-2 text-xs"
        onClick={onWide}
        title={previewModeTitle(viewMode, 'wide')}
      >
        <WideIcon className="h-3.5 w-3.5" />
        Wide
      </Button>
      <Button
        type="button"
        size="sm"
        variant={isOverlay ? 'secondary' : 'ghost'}
        className="h-7 gap-1.5 px-2 text-xs"
        onClick={isOverlay ? onDock : onOverlay}
        title={previewModeTitle(viewMode, 'overlay')}
      >
        <FocusIcon className="h-3.5 w-3.5" />
        Focus
      </Button>
    </div>
  );
}

function WebViewTabs({
  activeWebView,
  setActiveId,
  webviews,
}: Readonly<{
  activeWebView: DesktopWorkspaceWebViewState | null;
  setActiveId: (id: string) => void;
  webviews: readonly DesktopWorkspaceWebViewState[];
}>) {
  if (webviews.length <= 1) return null;

  return (
    <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-2">
      {webviews.map((webview) => (
        <WebViewTab
          activeWebViewId={activeWebView?.webviewId ?? null}
          key={webview.webviewId}
          setActiveId={setActiveId}
          webview={webview}
        />
      ))}
    </div>
  );
}

function WebViewTab({
  activeWebViewId,
  setActiveId,
  webview,
}: Readonly<{
  activeWebViewId: string | null;
  setActiveId: (id: string) => void;
  webview: DesktopWorkspaceWebViewState;
}>) {
  const focusWebView = () => {
    setActiveId(webview.webviewId);
    runBridgeAction(
      getDesktopWorkspaceBridge()?.focusWebView?.({
        webviewId: webview.webviewId,
      }),
    );
  };

  return (
    <button
      type="button"
      className={cn(
        'max-w-40 truncate rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground',
        webview.webviewId === activeWebViewId && 'bg-secondary text-foreground',
      )}
      onClick={focusWebView}
    >
      {webview.title ?? new URL(webview.url).hostname}
    </button>
  );
}

function PreviewViewportMessage({
  activeWebView,
  bridgeAvailable,
  onOpenExternal,
}: Readonly<{
  activeWebView: DesktopWorkspaceWebViewState | null;
  bridgeAvailable: boolean;
  onOpenExternal: () => void;
}>) {
  if (bridgeAvailable) {
    const messageProps = panelMessageProps(activeWebView, onOpenExternal);
    if (messageProps == null) return null;
    return <PanelMessage {...messageProps} />;
  }

  return (
    <PanelMessage
      title="Desktop preview unavailable"
      description="Embedded previews are available in the desktop shell. Browser mode opens preview resources externally."
    />
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
