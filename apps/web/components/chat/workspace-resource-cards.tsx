'use client';

import type {
  ProjectFileReadResult,
  ProjectGitFileDiffResult,
  WorkspaceEvent,
  WorkspaceResource,
} from '@agent-platform/contracts';
import {
  AlertCircle,
  Diff,
  ExternalLink,
  FileText,
  Globe,
  LoaderCircle,
  Terminal,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

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

export function WorkspaceResourceCards({ events }: Props) {
  const [selected, setSelected] = useState<WorkspaceResource | null>(null);
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
              onClick={() => setSelected(resource)}
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
      {selected && (
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
  if (state.loading) {
    return (
      <div className="flex min-h-full items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading preview…
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="flex min-h-full items-center justify-center gap-2 p-6 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        {state.error}
      </div>
    );
  }
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

export function WorkspaceResourceViewer({
  resource,
  onClose,
}: Readonly<{ resource: WorkspaceResource; onClose: () => void }>) {
  const panelRef = useRef<HTMLElement>(null);
  const descriptor = useMemo(() => workspacePreviewDescriptor(resource), [resource]);
  const state = useViewerContent(resource, descriptor);
  const displayLabel = workspaceResourceDisplayLabel(resource);
  const mimeType = metadataString(resource, 'mimeType');
  const externalUrl = safeWorkspacePreviewUrl(resource);
  const canOpenExternally = Boolean(externalUrl || getDesktopWorkspaceBridge());

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <aside
      ref={panelRef}
      aria-label="File preview"
      aria-modal="false"
      role="dialog"
      tabIndex={-1}
      data-testid="workspace-resource-viewer"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{displayLabel}</h2>
          <p className="text-xs text-muted-foreground">{descriptor.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
      <div className="min-h-0 flex-1 overflow-auto bg-muted/20">
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
    </aside>
  );
}
