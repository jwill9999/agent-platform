import type {
  DesktopCreateProjectFolderRequest,
  DesktopOpenProjectIdeRequest,
  DesktopOpenProjectIdeResult,
  DesktopProjectFolderSelectionResult,
  DesktopSelectedProjectFolder,
  DesktopTerminalCreateRequest,
  DesktopTerminalCreateResult,
  DesktopTerminalDataEvent,
  DesktopTerminalExitEvent,
  ProjectDesktopRecentProjectsResult,
  ProjectDesktopRecord,
  ProjectDesktopRegistrationResult,
  SessionProjectBindingResult,
} from '@agent-platform/contracts';
import { apiGet, apiPath, apiPost } from '@/lib/apiClient';

export interface DesktopProjectBridge {
  readonly projects?: {
    readonly createFolder?: (
      request: DesktopCreateProjectFolderRequest,
    ) => Promise<DesktopProjectFolderSelectionResult>;
    readonly openInIde?: (
      request: DesktopOpenProjectIdeRequest,
    ) => Promise<DesktopOpenProjectIdeResult>;
    readonly selectFolder?: () => Promise<DesktopProjectFolderSelectionResult>;
  };
  readonly terminal?: DesktopTerminalBridge;
}

export interface DesktopTerminalBridge {
  readonly create?: (request: DesktopTerminalCreateRequest) => Promise<DesktopTerminalCreateResult>;
  readonly input?: (request: { terminalId: string; data: string }) => Promise<void>;
  readonly resize?: (request: { terminalId: string; cols: number; rows: number }) => Promise<void>;
  readonly dispose?: (request: { terminalId: string }) => Promise<void>;
  readonly onData?: (callback: (event: DesktopTerminalDataEvent) => void) => () => void;
  readonly onExit?: (callback: (event: DesktopTerminalExitEvent) => void) => () => void;
}

export function getDesktopProjectBridge(): DesktopProjectBridge | undefined {
  if (globalThis.window === undefined) return undefined;
  return (globalThis as typeof globalThis & { agentPlatformDesktop?: DesktopProjectBridge })
    .agentPlatformDesktop;
}

export function hasDesktopProjectBridge(): boolean {
  return Boolean(getDesktopProjectBridge()?.projects?.selectFolder);
}

export function hasDesktopProjectCreationBridge(): boolean {
  return Boolean(getDesktopProjectBridge()?.projects?.createFolder);
}

export function hasDesktopProjectIdeBridge(): boolean {
  return Boolean(getDesktopProjectBridge()?.projects?.openInIde);
}

export function hasDesktopTerminalBridge(): boolean {
  const terminal = getDesktopProjectBridge()?.terminal;
  return Boolean(
    terminal?.create &&
    terminal.input &&
    terminal.resize &&
    terminal.dispose &&
    terminal.onData &&
    terminal.onExit,
  );
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

export async function createAndRegisterDesktopProject(
  request: DesktopCreateProjectFolderRequest,
): Promise<ProjectDesktopRegistrationResult | null> {
  const createFolder = getDesktopProjectBridge()?.projects?.createFolder;
  if (!createFolder) return null;
  const selection = await createFolder(request);
  if (selection.canceled) return null;
  return registerDesktopProject(selection.folder);
}

export async function openDesktopProjectIde(
  projectId: string,
): Promise<DesktopOpenProjectIdeResult | null> {
  const openInIde = getDesktopProjectBridge()?.projects?.openInIde;
  if (!openInIde) return null;
  return openInIde({ projectId });
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
