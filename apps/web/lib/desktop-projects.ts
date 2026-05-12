import type {
  ProjectDesktopRecentProjectsResult,
  ProjectDesktopRecord,
  ProjectDesktopRegistrationResult,
  SessionProjectBindingResult,
} from '@agent-platform/contracts';
import { apiGet, apiPath, apiPost } from '@/lib/apiClient';

export interface DesktopSelectedProjectFolder {
  readonly path: string;
  readonly name: string;
}

export type DesktopProjectFolderSelectionResult =
  | { readonly canceled: true }
  | { readonly canceled: false; readonly folder: DesktopSelectedProjectFolder };

export interface DesktopProjectBridge {
  readonly projects?: {
    readonly selectFolder?: () => Promise<DesktopProjectFolderSelectionResult>;
  };
}

export function getDesktopProjectBridge(): DesktopProjectBridge | undefined {
  if (globalThis.window === undefined) return undefined;
  return (globalThis as typeof globalThis & { agentPlatformDesktop?: DesktopProjectBridge })
    .agentPlatformDesktop;
}

export function hasDesktopProjectBridge(): boolean {
  return Boolean(getDesktopProjectBridge()?.projects?.selectFolder);
}

export async function registerDesktopProject(
  folder: DesktopSelectedProjectFolder,
): Promise<ProjectDesktopRegistrationResult | null> {
  return (
    (await apiPost<ProjectDesktopRegistrationResult>(
      apiPath('projects', 'desktop', 'register'),
      { path: folder.path, name: folder.name },
      { headers: { 'x-agent-platform-desktop-bridge': '1' } },
    )) ?? null
  );
}

export async function selectAndRegisterDesktopProject(): Promise<ProjectDesktopRegistrationResult | null> {
  const selectFolder = getDesktopProjectBridge()?.projects?.selectFolder;
  if (!selectFolder) return null;
  const selection = await selectFolder();
  if (selection.canceled) return null;
  return registerDesktopProject(selection.folder);
}

export async function loadRecentDesktopProjects(): Promise<ProjectDesktopRecord[]> {
  const result = await apiGet<ProjectDesktopRecentProjectsResult>(
    apiPath('projects', 'desktop', 'recent'),
  );
  return result?.projects ?? [];
}

export async function bindProjectSession(input: {
  readonly agentId: string;
  readonly projectId: string;
}): Promise<SessionProjectBindingResult | null> {
  return (
    (await apiPost<SessionProjectBindingResult>(apiPath('sessions', 'project'), input)) ?? null
  );
}
