'use client';

import type {
  ProjectFileReadResult,
  ProjectGitFileDiffResult,
  WorkspaceEvent,
  WorkspaceResource,
} from '@agent-platform/contracts';
import { WorkspaceResourceSchema } from '@agent-platform/contracts';
import {
  AlertCircle,
  Diff,
  Download,
  ExternalLink,
  FileText,
  Globe,
  LoaderCircle,
  Minimize2,
  PanelRightOpen,
  Terminal,
  X,
} from 'lucide-react';
import React, {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Markdown } from '@/components/chat/markdown';
import { Button } from '@/components/ui/button';
import { apiGet, apiPath, ApiRequestError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { getDesktopWorkspaceBridge } from '@/lib/desktop-workspace';
import {
  safeWorkspacePreviewUrl,
  workspacePreviewDescriptor,
  workspaceResourceBinaryPreviewUrl,
  workspaceResourceDiffMode,
  workspaceResourceDisplayLabel,
  workspaceResourceInlineContent,
  workspaceResourcePath,
  type WorkspacePreviewDescriptor,
} from '@/lib/workspace-preview';
import {
  activateWorkspaceResourceTab,
  closeWorkspaceResourceTab,
  EMPTY_WORKSPACE_RESOURCE_TABS,
  minimizeWorkspaceResourceTabs,
  openWorkspaceResourceTab,
  restoreWorkspaceResourceTabs,
  workspaceResourceIdentity,
  type WorkspaceResourceTabsState,
} from '@/lib/workspace-resource-tabs';

type Props = Readonly<{
  events: readonly WorkspaceEvent[];
}>;

type ViewerContent = Readonly<{
  content?: string;
  error?: string;
  loading: boolean;
  previewUrl?: string;
}>;

function resourceIcon(resource: WorkspaceResource) {
  switch (resource.kind) {
    case 'diff':
      return Diff;
    case 'preview':
    case 'webview':
      return Globe;
    case 'terminal':
      return Terminal;
    case 'file':
      return FileText;
  }
}

function metadataString(resource: WorkspaceResource, key: string): string | undefined {
  const value = resource.metadata[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function openWorkspaceResourceCard(resource: WorkspaceResource): void {
  const desktopWorkspace = getDesktopWorkspaceBridge();
  if (desktopWorkspace) {
    void desktopWorkspace.openResource({ uri: resource.uri }).then((result) => {
      if (!result.handled && result.externalFallbackUrl) {
        void desktopWorkspace.openExternalFallback({ url: result.externalFallbackUrl });
      }
    });
    return;
  }

  const fallbackUrl = safeWorkspacePreviewUrl(resource);
  if (fallbackUrl) {
    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  window.dispatchEvent(
    new CustomEvent('agent-platform:workspace-resource-open', {
      detail: { uri: resource.uri, kind: resource.kind, metadata: resource.metadata },
    }),
  );
}

function resourceTone(resource: WorkspaceResource): string {
  if (resource.kind === 'diff') return 'border-blue-200 bg-blue-50/60 text-blue-950';
  if (resource.kind === 'preview' || resource.kind === 'webview') {
    return 'border-emerald-200 bg-emerald-50/60 text-emerald-950';
  }
  if (resource.kind === 'terminal') return 'border-zinc-300 bg-zinc-50 text-zinc-950';
  return 'border-border bg-card text-card-foreground';
}

function resourceKey(resource: WorkspaceResource): string {
  return `${resource.uri}-${resource.createdAt}`;
}

export type WorkspaceResourcePreviewActions = Readonly<{
  openResource: (resource: WorkspaceResource, trigger?: HTMLElement | null) => void;
}>;

const ResourceTabsContext = createContext<WorkspaceResourcePreviewActions | null>(null);

function tabsStorageKey(scopeKey: string): string {
  return `agent-platform:workspace-resource-tabs:${encodeURIComponent(scopeKey)}`;
}

function loadTabs(scopeKey: string, projectId?: string): WorkspaceResourceTabsState {
  if (globalThis.window === undefined) return EMPTY_WORKSPACE_RESOURCE_TABS;
  try {
    const value: unknown = JSON.parse(
      globalThis.sessionStorage.getItem(tabsStorageKey(scopeKey)) ?? 'null',
    );
    if (!value || typeof value !== 'object') return EMPTY_WORKSPACE_RESOURCE_TABS;
    const record = value as Record<string, unknown>;
    const resources = Array.isArray(record.resources)
      ? record.resources
          .map((resource) => WorkspaceResourceSchema.safeParse(resource))
          .filter((result) => result.success)
          .map((result) => result.data)
          .filter((resource) => !projectId || resource.projectId === projectId)
      : [];
    if (resources.length === 0) return EMPTY_WORKSPACE_RESOURCE_TABS;
    const restored = resources.reduce(
      (current, resource) => openWorkspaceResourceTab(current, resource),
      EMPTY_WORKSPACE_RESOURCE_TABS,
    );
    const activeUri =
      typeof record.activeUri === 'string' &&
      restored.resources.some(
        (resource) => workspaceResourceIdentity(resource) === record.activeUri,
      )
        ? record.activeUri
        : restored.activeUri;
    return { activeUri, minimized: record.minimized === true, resources: restored.resources };
  } catch {
    return EMPTY_WORKSPACE_RESOURCE_TABS;
  }
}

export function WorkspaceResourcePreviewProvider({
  children,
  projectId,
  scopeKey,
}: Readonly<{
  children: ReactNode;
  projectId?: string;
  scopeKey: string;
}>) {
  const [state, setState] = useState<WorkspaceResourceTabsState>(() =>
    loadTabs(scopeKey, projectId),
  );
  const dockRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    try {
      globalThis.sessionStorage.setItem(tabsStorageKey(scopeKey), JSON.stringify(state));
    } catch {
      // A full or disabled session store must not break the preview workspace.
    }
  }, [scopeKey, state]);

  useEffect(() => {
    if (state.minimized) dockRef.current?.focus();
  }, [state.minimized]);

  const activeResource = state.resources.find(
    (resource) => workspaceResourceIdentity(resource) === state.activeUri,
  );

  function closeTab(uri: string): void {
    setState((current) => {
      const next = closeWorkspaceResourceTab(current, uri);
      if (next.resources.length === 0) {
        globalThis.queueMicrotask(() => returnFocusRef.current?.focus());
      }
      return next;
    });
  }

  const context = useMemo<WorkspaceResourcePreviewActions>(
    () => ({
      openResource(resource, trigger) {
        if (projectId && resource.projectId !== projectId) return;
        if (trigger) returnFocusRef.current = trigger;
        setState((current) => openWorkspaceResourceTab(current, resource));
      },
    }),
    [projectId],
  );

  return (
    <ResourceTabsContext.Provider value={context}>
      {children}
      {activeResource && !state.minimized && (
        <WorkspaceResourceViewer
          resource={activeResource}
          resources={state.resources}
          onActivate={(uri) => setState((current) => activateWorkspaceResourceTab(current, uri))}
          onClose={() => closeTab(workspaceResourceIdentity(activeResource))}
          onCloseTab={closeTab}
          onMinimize={() => setState(minimizeWorkspaceResourceTabs)}
        />
      )}
      {activeResource && state.minimized && (
        <Button
          ref={dockRef}
          type="button"
          className="fixed right-3 top-1/2 z-50 max-w-[calc(100vw-1.5rem)] -translate-y-1/2 shadow-xl"
          onClick={() => setState(restoreWorkspaceResourceTabs)}
          aria-label={`Restore ${state.resources.length} open preview${state.resources.length === 1 ? '' : 's'}`}
          data-testid="workspace-resource-preview-dock"
        >
          <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
          {state.resources.length} preview{state.resources.length === 1 ? '' : 's'}
        </Button>
      )}
    </ResourceTabsContext.Provider>
  );
}

export function useWorkspaceResourcePreviewActions(): WorkspaceResourcePreviewActions | null {
  return useContext(ResourceTabsContext);
}

export function WorkspaceResourceCards({ events }: Props) {
  const [selected, setSelected] = useState<WorkspaceResource | null>(null);
  const tabs = useWorkspaceResourcePreviewActions();
  const resources = useMemo(
    () =>
      events
        .map((event) => event.resource)
        .filter((resource): resource is WorkspaceResource => Boolean(resource)),
    [events],
  );

  if (resources.length === 0) return null;

  return (
    <>
      <div className="mt-3 grid gap-2" data-testid="workspace-resource-cards">
        {resources.map((resource) => {
          const Icon = resourceIcon(resource);
          const descriptor = workspacePreviewDescriptor(resource);
          const displayLabel = workspaceResourceDisplayLabel(resource);
          return (
            <button
              key={resourceKey(resource)}
              type="button"
              className={cn(
                'flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                resourceTone(resource),
              )}
              onClick={(event) => {
                if (tabs) tabs.openResource(resource, event.currentTarget);
                else setSelected(resource);
              }}
              aria-label={`${descriptor.label}: ${displayLabel}`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{displayLabel}</span>
                <span className="block truncate text-xs opacity-70">{descriptor.description}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                {descriptor.label}
              </span>
            </button>
          );
        })}
      </div>
      {!tabs && selected && (
        <WorkspaceResourceViewer resource={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function viewerRequest(resource: WorkspaceResource, descriptor: WorkspacePreviewDescriptor) {
  const path = workspaceResourcePath(resource);
  if (!path) return undefined;
  const params = new URLSearchParams({ path });
  if (descriptor.mode === 'diff') {
    params.set('mode', workspaceResourceDiffMode(resource));
    return {
      kind: 'diff' as const,
      url: `${apiPath('projects', resource.projectId, 'git', 'diff')}?${params.toString()}`,
    };
  }
  if (descriptor.kind === 'html' || descriptor.kind === 'markdown' || descriptor.kind === 'text') {
    return {
      kind: 'file' as const,
      url: `${apiPath('projects', resource.projectId, 'files', 'read')}?${params.toString()}`,
    };
  }
  return undefined;
}

function useViewerContent(
  resource: WorkspaceResource,
  descriptor: WorkspacePreviewDescriptor,
): ViewerContent {
  const inlineContent = workspaceResourceInlineContent(resource);
  const binaryPreviewUrl =
    descriptor.kind === 'image' || descriptor.kind === 'pdf'
      ? workspaceResourceBinaryPreviewUrl(resource)
      : undefined;
  const explicitPreviewUrl =
    descriptor.kind === 'html' ? safeWorkspacePreviewUrl(resource) : undefined;
  const request = useMemo(() => viewerRequest(resource, descriptor), [descriptor, resource]);
  const [state, setState] = useState<ViewerContent>(() => ({
    ...(inlineContent ? { content: inlineContent } : {}),
    ...(binaryPreviewUrl || explicitPreviewUrl
      ? { previewUrl: binaryPreviewUrl ?? explicitPreviewUrl }
      : {}),
    loading: Boolean(request && !inlineContent && !explicitPreviewUrl),
  }));

  useEffect(() => {
    if (inlineContent || binaryPreviewUrl || explicitPreviewUrl) {
      setState({
        ...(inlineContent ? { content: inlineContent } : {}),
        ...(binaryPreviewUrl || explicitPreviewUrl
          ? { previewUrl: binaryPreviewUrl ?? explicitPreviewUrl }
          : {}),
        loading: false,
      });
      return;
    }
    if (!request) {
      setState({ loading: false });
      return;
    }

    let cancelled = false;
    setState({ loading: true });
    const load =
      request.kind === 'diff'
        ? apiGet<ProjectGitFileDiffResult>(request.url).then((result) => result?.diff)
        : apiGet<ProjectFileReadResult>(request.url).then((result) => result?.content);
    void load
      .then((content) => {
        if (!cancelled) {
          setState(
            content === undefined
              ? { loading: false, error: 'Preview data is unavailable.' }
              : { loading: false, content },
          );
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setState({
            loading: false,
            error:
              cause instanceof ApiRequestError
                ? cause.message
                : 'The file could not be loaded for preview.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [binaryPreviewUrl, explicitPreviewUrl, inlineContent, request]);

  return state;
}

function DiffPreview({ content }: Readonly<{ content: string }>) {
  if (!content.trim()) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No changes are available for this file and selection.
      </div>
    );
  }
  return (
    <pre
      className="min-w-max whitespace-pre p-5 font-mono text-xs leading-5 text-slate-200"
      data-testid="workspace-resource-diff"
    >
      {content}
    </pre>
  );
}

function PreviewLoadingState() {
  return (
    <div className="flex min-h-full items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      Loading preview…
    </div>
  );
}

function PreviewErrorState({ error }: Readonly<{ error: string }>) {
  return (
    <div className="flex min-h-full items-center justify-center gap-2 p-6 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      {error}
    </div>
  );
}

function ViewerPreview({
  descriptor,
  displayLabel,
  resource,
  state,
}: Readonly<{
  descriptor: WorkspacePreviewDescriptor;
  displayLabel: string;
  resource: WorkspaceResource;
  state: ViewerContent;
}>) {
  if (descriptor.kind === 'image' && state.previewUrl) {
    return (
      <div className="flex min-h-full items-start justify-center p-6">
        <img
          src={state.previewUrl}
          alt={displayLabel}
          className="max-h-full max-w-full rounded object-contain shadow-sm"
        />
      </div>
    );
  }
  if (descriptor.kind === 'pdf' && state.previewUrl) {
    return (
      <iframe
        title={displayLabel}
        src={state.previewUrl}
        className="h-full min-h-[32rem] w-full border-0 bg-background"
        referrerPolicy="no-referrer"
      />
    );
  }
  if (descriptor.kind === 'html' && (state.content || state.previewUrl)) {
    return (
      <iframe
        title={displayLabel}
        {...(state.content ? { srcDoc: state.content } : { src: state.previewUrl })}
        sandbox="allow-forms allow-modals allow-popups allow-scripts"
        referrerPolicy="no-referrer"
        className="h-full min-h-[32rem] w-full border-0 bg-background"
        data-testid="workspace-resource-html-preview"
      />
    );
  }
  if (descriptor.kind === 'markdown' && state.content !== undefined) {
    return (
      <Markdown
        content={state.content}
        className="p-6 text-sm"
        workspaceWebViewProjectId={resource.projectId}
      />
    );
  }
  if (descriptor.kind === 'diff' && state.content !== undefined) {
    return (
      <div className="min-h-full overflow-auto bg-slate-950">
        <DiffPreview content={state.content} />
      </div>
    );
  }
  if (descriptor.kind === 'text' && state.content !== undefined) {
    return (
      <pre className="whitespace-pre-wrap break-words p-6 font-mono text-sm text-foreground">
        {state.content}
      </pre>
    );
  }
  return (
    <div className="flex min-h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {descriptor.canPreview
        ? 'Preview data is not available in this message.'
        : descriptor.description}
    </div>
  );
}

function ViewerBody({
  descriptor,
  displayLabel,
  resource,
  state,
}: Readonly<{
  descriptor: WorkspacePreviewDescriptor;
  displayLabel: string;
  resource: WorkspaceResource;
  state: ViewerContent;
}>) {
  if (state.loading) return <PreviewLoadingState />;
  if (state.error) return <PreviewErrorState error={state.error} />;
  return (
    <ViewerPreview
      descriptor={descriptor}
      displayLabel={displayLabel}
      resource={resource}
      state={state}
    />
  );
}

export function WorkspaceResourceViewer({
  resource,
  resources = [resource],
  onActivate,
  onClose,
  onCloseTab,
  onMinimize,
}: Readonly<{
  resource: WorkspaceResource;
  resources?: readonly WorkspaceResource[];
  onActivate?: (uri: string) => void;
  onClose: () => void;
  onCloseTab?: (uri: string) => void;
  onMinimize?: () => void;
}>) {
  const panelRef = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [exportStatus, setExportStatus] = useState<string>();
  const descriptor = useMemo(() => workspacePreviewDescriptor(resource), [resource]);
  const state = useViewerContent(resource, descriptor);
  const displayLabel = workspaceResourceDisplayLabel(resource);
  const mimeType = metadataString(resource, 'mimeType');
  const externalUrl = safeWorkspacePreviewUrl(resource);
  const canOpenExternally = Boolean(externalUrl || getDesktopWorkspaceBridge());
  const desktopWorkspace = getDesktopWorkspaceBridge();
  const canExport = resource.kind === 'file' && Boolean(workspaceResourcePath(resource));
  const exportUrl = `${apiPath('projects', resource.projectId, 'resources', 'export')}?${new URLSearchParams({ uri: resource.uri }).toString()}`;
  const activeIndex = resources.findIndex(
    (candidate) => workspaceResourceIdentity(candidate) === workspaceResourceIdentity(resource),
  );
  const activeTabId = `workspace-resource-tab-${Math.max(activeIndex, 0)}`;
  const activePanelId = `workspace-resource-panel-${Math.max(activeIndex, 0)}`;

  async function saveAs(): Promise<void> {
    if (!desktopWorkspace) return;
    setExportStatus(undefined);
    try {
      const result = await desktopWorkspace.saveResourceAs({
        uri: resource.uri,
        suggestedFilename: displayLabel.split('/').at(-1) ?? displayLabel,
      });
      if (result.status === 'saved') {
        setExportStatus(`${result.filename} was saved.`);
      }
    } catch {
      setExportStatus('The resource could not be saved. Try again.');
    }
  }

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    tabRefs.current[Math.max(activeIndex, 0)]?.focus();
  }, [activeIndex, resource.uri]);

  function closeResourceAt(index: number): void {
    const target = resources[index];
    if (!target) return;
    if (onCloseTab) onCloseTab(workspaceResourceIdentity(target));
    else onClose();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % resources.length;
    else if (event.key === 'ArrowLeft')
      nextIndex = (index - 1 + resources.length) % resources.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = resources.length - 1;
    else if (event.key === 'Delete' || ((event.metaKey || event.ctrlKey) && event.key === 'w')) {
      event.preventDefault();
      closeResourceAt(index);
      return;
    }
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = resources[nextIndex];
    if (!next) return;
    onActivate?.(workspaceResourceIdentity(next));
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <dialog
      ref={panelRef}
      open
      aria-label="Resource previews"
      tabIndex={-1}
      data-testid="workspace-resource-viewer"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-background shadow-2xl md:w-[min(42rem,45vw)]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{displayLabel}</h2>
          <p className="text-xs text-muted-foreground">{descriptor.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canExport &&
            (desktopWorkspace ? (
              <Button type="button" size="sm" variant="outline" onClick={() => void saveAs()}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Save As
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <a href={exportUrl} download>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download
                </a>
              </Button>
            ))}
          {canOpenExternally && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openWorkspaceResourceCard(resource)}
            >
              Open externally
            </Button>
          )}
          {onMinimize && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onMinimize}
              aria-label="Minimize previews"
            >
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>
      <div
        role="tablist"
        aria-label="Open resource previews"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 pt-2"
      >
        {resources.map((tabResource, index) => {
          const uri = workspaceResourceIdentity(tabResource);
          const selected = uri === workspaceResourceIdentity(resource);
          const label = workspaceResourceDisplayLabel(tabResource);
          return (
            <div
              key={uri}
              className={cn(
                'flex max-w-56 shrink-0 items-center rounded-t-md border border-b-0',
                selected ? 'bg-background text-foreground' : 'bg-muted/50 text-muted-foreground',
              )}
            >
              <button
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={`workspace-resource-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`workspace-resource-panel-${index}`}
                tabIndex={selected ? 0 : -1}
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onActivate?.(uri)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {label}
              </button>
              <button
                type="button"
                className="mr-1 rounded p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Close preview ${label}`}
                onClick={() => closeResourceAt(index)}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      {exportStatus && (
        <output className="border-b border-border px-4 py-2 text-sm">{exportStatus}</output>
      )}
      <div
        id={activePanelId}
        role="tabpanel"
        aria-labelledby={activeTabId}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto bg-muted/20"
      >
        <ViewerBody
          descriptor={descriptor}
          displayLabel={displayLabel}
          resource={resource}
          state={state}
        />
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          {descriptor.mode === 'diff'
            ? `${workspaceResourceDiffMode(resource)} changes`
            : descriptor.mode}
        </span>
        {mimeType && <span>{mimeType}</span>}
      </footer>
    </dialog>
  );
}
