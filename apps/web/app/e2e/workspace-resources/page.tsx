import {
  workspaceResourceUri,
  type WorkspaceEvent,
  type WorkspaceResource,
} from '@agent-platform/contracts';

import {
  WorkspaceResourceCards,
  WorkspaceResourcePreviewProvider,
} from '@/components/chat/workspace-resource-cards';
import { ProjectActivityPanel } from '@/components/project/project-activity-panel';

const PROJECT_ID = 'e2e-project';
const CREATED_AT = '2026-08-04T09:00:00.000Z';

function fileResource(
  projectId: string,
  path: string,
  mimeType: string,
  metadata: Record<string, unknown> = {},
): WorkspaceResource {
  return {
    uri: workspaceResourceUri({ projectId, kind: 'file', target: path }),
    kind: 'file',
    projectId,
    label: path.split('/').at(-1) ?? 'Generated file',
    metadata: { relativePath: path, mimeType, ...metadata },
    createdAt: CREATED_AT,
  };
}

function workspaceResources(projectId: string): WorkspaceResource[] {
  return [
    fileResource(projectId, 'generated/app.html', 'text/html', {
      content: '<main><h1>Generated app preview</h1></main>',
    }),
    fileResource(projectId, 'generated/notes.md', 'text/markdown', {
      content: '# Generated notes\n\nProject context stays visible.',
    }),
    fileResource(projectId, 'generated/report.pdf', 'application/pdf'),
    fileResource(projectId, 'generated/chart.png', 'image/png'),
    fileResource(projectId, 'src/index.ts', 'text/typescript', {
      content: 'export const projectExperience = true;\n',
    }),
    fileResource(projectId, 'generated/missing.txt', 'text/plain'),
    fileResource(projectId, 'generated/archive.zip', 'application/zip'),
    {
      uri: workspaceResourceUri({
        projectId,
        kind: 'diff',
        target: 'src/index.ts',
      }),
      kind: 'diff',
      projectId,
      label: 'Diff: src/index.ts',
      metadata: {
        relativePath: 'src/index.ts',
        mode: 'unstaged',
        diff: '@@ -1 +1 @@\n-export const value = false;\n+export const value = true;',
      },
      createdAt: CREATED_AT,
    },
  ];
}

export default async function WorkspaceResourcesE2EPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ projectId?: string; sessionId?: string }> }>) {
  const params = await searchParams;
  const projectId = params.projectId ?? PROJECT_ID;
  const sessionId = params.sessionId ?? 'e2e-session';
  const events: WorkspaceEvent[] = workspaceResources(projectId).map((resource) => ({
    type: resource.kind === 'diff' ? 'diff_created' : 'resource_created',
    resource,
    action: 'preview',
    metadata: {},
  }));
  return (
    <main
      className="h-screen overflow-hidden bg-background text-foreground"
      data-workspace-surface="project-chat"
    >
      <WorkspaceResourcePreviewProvider
        key={`${projectId}:${sessionId}`}
        scopeKey={`e2e:${projectId}:${sessionId}`}
        projectId={projectId}
      >
        <div className="flex h-full min-h-0">
          <section className="min-w-0 flex-1 overflow-y-auto p-8">
            <div className="mx-auto max-w-3xl">
              <p className="text-xs text-muted-foreground">Project · feature/project-experience</p>
              <h1 className="mt-1 text-xl font-semibold">Project Chat resource previews</h1>
              <p data-testid="project-context" className="mt-2 text-sm text-muted-foreground">
                Session {sessionId} · Conversation e2e-conversation
              </p>
              <WorkspaceResourceCards events={events} />
            </div>
          </section>
          <ProjectActivityPanel
            projectId={projectId}
            sessionId={sessionId}
            profile="coding"
            workspaceEventsByMessage={{ 'e2e-message': events }}
          />
        </div>
      </WorkspaceResourcePreviewProvider>
    </main>
  );
}
