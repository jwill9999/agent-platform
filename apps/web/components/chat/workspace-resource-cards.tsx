'use client';

import type { WorkspaceEvent, WorkspaceResource } from '@agent-platform/contracts';
import { Diff, ExternalLink, FileText, Globe, Terminal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { getDesktopWorkspaceBridge, workspaceResourceFallbackUrl } from '@/lib/desktop-workspace';

type Props = {
  events: readonly WorkspaceEvent[];
};

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

function actionLabel(resource: WorkspaceResource): string {
  if (resource.kind === 'diff') return 'Open diff';
  if (resource.kind === 'preview' || resource.kind === 'webview') return 'Preview';
  if (resource.kind === 'terminal') return 'Open terminal';
  return 'Open file';
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

  const fallbackUrl = workspaceResourceFallbackUrl(resource);
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

export function WorkspaceResourceCards({ events }: Props) {
  const resources = events
    .map((event) => event.resource)
    .filter((resource): resource is WorkspaceResource => Boolean(resource));

  if (resources.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2" data-testid="workspace-resource-cards">
      {resources.map((resource) => {
        const Icon = resourceIcon(resource);
        const path = metadataString(resource, 'path');
        return (
          <div
            key={`${resource.uri}-${resource.createdAt}`}
            className={cn(
              'flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-sm',
              resourceTone(resource),
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{resource.label}</div>
              <div className="truncate text-xs opacity-70">{path ?? resource.kind}</div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1 bg-background/80"
              onClick={() => openWorkspaceResourceCard(resource)}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{actionLabel(resource)}</span>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
