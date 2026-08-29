import {
  parseWorkspaceResourceUri,
  workspaceResourceUri,
  type WorkspaceResource,
} from '@agent-platform/contracts';

export type WorkspaceResourceTabsState = Readonly<{
  activeUri?: string;
  minimized: boolean;
  resources: readonly WorkspaceResource[];
}>;

export const EMPTY_WORKSPACE_RESOURCE_TABS: WorkspaceResourceTabsState = {
  minimized: false,
  resources: [],
};

export function workspaceResourceIdentity(resource: WorkspaceResource): string {
  const parsed = parseWorkspaceResourceUri(resource.uri);
  return workspaceResourceUri(parsed);
}

export function openWorkspaceResourceTab(
  state: WorkspaceResourceTabsState,
  resource: WorkspaceResource,
): WorkspaceResourceTabsState {
  const identity = workspaceResourceIdentity(resource);
  const existingIndex = state.resources.findIndex(
    (candidate) => workspaceResourceIdentity(candidate) === identity,
  );
  const resources = [...state.resources];
  if (existingIndex >= 0) resources[existingIndex] = resource;
  else resources.push(resource);
  return { activeUri: identity, minimized: false, resources };
}

export function activateWorkspaceResourceTab(
  state: WorkspaceResourceTabsState,
  uri: string,
): WorkspaceResourceTabsState {
  return state.resources.some((resource) => workspaceResourceIdentity(resource) === uri)
    ? { ...state, activeUri: uri }
    : state;
}

export function closeWorkspaceResourceTab(
  state: WorkspaceResourceTabsState,
  uri: string,
): WorkspaceResourceTabsState {
  const index = state.resources.findIndex(
    (resource) => workspaceResourceIdentity(resource) === uri,
  );
  if (index < 0) return state;
  const resources = state.resources.filter((_, resourceIndex) => resourceIndex !== index);
  if (resources.length === 0) return EMPTY_WORKSPACE_RESOURCE_TABS;
  if (state.activeUri !== uri) return { ...state, resources };
  return {
    activeUri: workspaceResourceIdentity(resources[Math.min(index, resources.length - 1)]!),
    minimized: state.minimized,
    resources,
  };
}

export function minimizeWorkspaceResourceTabs(
  state: WorkspaceResourceTabsState,
): WorkspaceResourceTabsState {
  return state.resources.length > 0 ? { ...state, minimized: true } : state;
}

export function restoreWorkspaceResourceTabs(
  state: WorkspaceResourceTabsState,
): WorkspaceResourceTabsState {
  return state.resources.length > 0 ? { ...state, minimized: false } : state;
}
