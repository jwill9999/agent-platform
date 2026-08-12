'use client';

import {
  workspaceResourceUri,
  type WorkspaceEvent,
  type WorkspaceResource,
} from '@agent-platform/contracts';

import { WorkspaceResourceCards } from '@/components/chat/workspace-resource-cards';

const PROJECT_ID = 'e2e-project';
const CREATED_AT = '2026-08-04T09:00:00.000Z';

function fileResource(
  path: string,
  mimeType: string,
  metadata: Record<string, unknown> = {},
): WorkspaceResource {
  return {
    uri: workspaceResourceUri({ projectId: PROJECT_ID, kind: 'file', target: path }),
    kind: 'file',
    projectId: PROJECT_ID,
    label: path.split('/').at(-1) ?? 'Generated file',
    metadata: { relativePath: path, mimeType, ...metadata },
    createdAt: CREATED_AT,
  };
}

const resources: WorkspaceResource[] = [
  fileResource('generated/app.html', 'text/html', {
    content: '<main><h1>Generated app preview</h1></main>',
  }),
  fileResource('generated/notes.md', 'text/markdown', {
    content: '# Generated notes\n\nProject context stays visible.',
  }),
  fileResource('generated/report.pdf', 'application/pdf'),
  fileResource('generated/chart.png', 'image/png'),
  fileResource('src/index.ts', 'text/typescript', {
    content: 'export const projectExperience = true;\n',
  }),
  fileResource('generated/archive.zip', 'application/zip'),
  {
    uri: workspaceResourceUri({
      projectId: PROJECT_ID,
      kind: 'diff',
      target: 'src/index.ts',
    }),
    kind: 'diff',
    projectId: PROJECT_ID,
    label: 'Diff: src/index.ts',
    metadata: {
      relativePath: 'src/index.ts',
      mode: 'unstaged',
      diff: '@@ -1 +1 @@\n-export const value = false;\n+export const value = true;',
    },
    createdAt: CREATED_AT,
  },
];

const events: WorkspaceEvent[] = resources.map((resource) => ({
  type: resource.kind === 'diff' ? 'diff_created' : 'resource_created',
  resource,
  action: 'preview',
  metadata: {},
}));

export default function WorkspaceResourcesE2EPage() {
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
