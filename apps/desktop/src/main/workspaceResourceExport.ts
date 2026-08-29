import {
  DesktopWorkspaceExportResultSchema,
  parseWorkspaceResourceUri,
  type DesktopWorkspaceExportResult,
  type WorkspaceResourceExportRequest,
} from '@agent-platform/contracts';
import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

type SaveDialogResult = Readonly<{
  canceled: boolean;
  filePath?: string;
}>;

export type WorkspaceResourceExportDependencies = Readonly<{
  apiBaseUrl: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  showSaveDialog: (options: {
    readonly defaultPath: string;
    readonly title: string;
  }) => Promise<SaveDialogResult>;
  writeFileImpl?: typeof writeFile;
}>;

export const desktopWorkspaceSaveOverrideQueueEnv =
  'AGENT_PLATFORM_DESKTOP_TEST_SAVE_RESOURCE_PATHS';

function consumeSaveDialogOverride(env: NodeJS.ProcessEnv): SaveDialogResult | undefined {
  const queued = env[desktopWorkspaceSaveOverrideQueueEnv];
  if (queued === undefined) return undefined;
  const parsed = JSON.parse(queued) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${desktopWorkspaceSaveOverrideQueueEnv} must be a JSON array.`);
  }
  const [next, ...remaining] = parsed;
  if (next !== null && typeof next !== 'string') {
    throw new Error(`${desktopWorkspaceSaveOverrideQueueEnv} entries must be paths or null.`);
  }
  env[desktopWorkspaceSaveOverrideQueueEnv] = JSON.stringify(remaining);
  return next === null || next === '' ? { canceled: true } : { canceled: false, filePath: next };
}

function safeSuggestedFilename(request: WorkspaceResourceExportRequest): string {
  const parsed = parseWorkspaceResourceUri(request.uri);
  const candidate = request.suggestedFilename ?? basename(parsed.target);
  const normalized = [...basename(candidate)]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127 || character === '"' || character === '\\'
        ? '_'
        : character;
    })
    .join('')
    .trim();
  return normalized && normalized !== '.' && normalized !== '..'
    ? normalized.slice(0, 255)
    : 'download';
}

export async function saveWorkspaceResourceAs(
  request: WorkspaceResourceExportRequest,
  dependencies: WorkspaceResourceExportDependencies,
): Promise<DesktopWorkspaceExportResult> {
  const resource = parseWorkspaceResourceUri(request.uri);
  if (resource.kind !== 'file') {
    throw new Error('This Project resource cannot be saved.');
  }

  const dialogResult =
    consumeSaveDialogOverride(dependencies.env ?? process.env) ??
    (await dependencies.showSaveDialog({
      defaultPath: safeSuggestedFilename(request),
      title: 'Save Project resource as',
    }));
  if (dialogResult.canceled || !dialogResult.filePath) {
    return DesktopWorkspaceExportResultSchema.parse({ ok: true, status: 'cancelled' });
  }

  const apiUrl = new URL(
    `/v1/projects/${encodeURIComponent(resource.projectId)}/resources/export`,
    dependencies.apiBaseUrl,
  );
  apiUrl.searchParams.set('uri', request.uri);

  const response = await (dependencies.fetchImpl ?? fetch)(apiUrl, {
    headers: { 'x-agent-platform-desktop-bridge': '1' },
  });
  if (!response.ok) {
    throw new Error('The Project resource could not be prepared for saving.');
  }

  const content = Buffer.from(await response.arrayBuffer());
  try {
    await (dependencies.writeFileImpl ?? writeFile)(dialogResult.filePath, content, {
      flag: 'w',
    });
  } catch {
    throw new Error('The selected file could not be written.');
  }

  return DesktopWorkspaceExportResultSchema.parse({
    ok: true,
    status: 'saved',
    filename: basename(dialogResult.filePath),
  });
}
