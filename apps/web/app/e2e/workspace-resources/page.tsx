import {
  workspaceResourceUri,
  type WorkspaceEvent,
  type WorkspaceResource,
} from '@agent-platform/contracts';

import { WorkspaceResourceCards } from '@/components/chat/workspace-resource-cards';

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
}: Readonly<{ searchParams: Promise<{ projectId?: string }> }>) {
  const projectId = (await searchParams).projectId ?? PROJECT_ID;
  const events: WorkspaceEvent[] = workspaceResources(projectId).map((resource) => ({
    type: resource.kind === 'diff' ? 'diff_created' : 'resource_created',
    resource,
    action: 'preview',
    metadata: {},
  }));
  return (
    <main
      className="min-h-screen bg-background p-8 text-foreground"
      data-workspace-surface="project-chat"
    >
      <section className="mx-auto max-w-3xl">
        <p className="text-xs text-muted-foreground">Project · feature/project-experience</p>
        <h1 className="mt-1 text-xl font-semibold">Project Chat resource previews</h1>
        <p data-testid="project-context" className="mt-2 text-sm text-muted-foreground">
          Session e2e-session · Conversation e2e-conversation
        </p>
        <WorkspaceResourceCards events={events} />
      </section>
    </main>
  );
}
