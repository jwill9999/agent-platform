import { describe, expect, it } from 'vitest';

import {
  desktopBridgeApiKeys,
  desktopBridgeApiName,
  desktopMaintenanceApiKeys,
  desktopProjectsApiKeys,
  desktopTerminalApiKeys,
  desktopWorkspaceApiKeys,
  closeWorkspaceWebViewIpcChannel,
  createTerminalIpcChannel,
  disposeTerminalIpcChannel,
  focusWorkspaceWebViewIpcChannel,
  goBackWorkspaceWebViewIpcChannel,
  goForwardWorkspaceWebViewIpcChannel,
  inputTerminalIpcChannel,
  listWorkspaceWebViewsIpcChannel,
  createProjectFolderIpcChannel,
  openWorkspaceExternalFallbackIpcChannel,
  openWorkspaceResourceIpcChannel,
  openWorkspaceWebViewIpcChannel,
  openProjectIdeIpcChannel,
  reloadWorkspaceWebViewIpcChannel,
  repairMacosVmRuntimeIpcChannel,
  resetLocalDataConfirmationIpcChannel,
  resetLocalDataIpcChannel,
  resizeTerminalIpcChannel,
  selectProjectFolderIpcChannel,
  setWorkspaceWebViewBoundsIpcChannel,
  desktopVersionsApiKeys,
  workspaceWebViewUpdatedIpcChannel,
} from '../src/preload/desktopBridge.js';

describe('desktop preload bridge contract', () => {
  it('uses a single named desktop API surface', () => {
    expect(desktopBridgeApiName).toBe('agentPlatformDesktop');
  });

  it('limits the root bridge keys to the explicit contract', () => {
    expect(desktopBridgeApiKeys).toEqual([
      'maintenance',
      'projects',
      'terminal',
      'workspace',
      'versions',
    ]);
  });

  it('limits maintenance helpers to explicit destructive actions', () => {
    expect(desktopMaintenanceApiKeys).toEqual([
      'getResetLocalDataConfirmation',
      'repairMacosVmRuntime',
      'resetLocalData',
    ]);
  });

  it('limits version helpers to runtime version readers', () => {
    expect(desktopVersionsApiKeys).toEqual(['chrome', 'electron', 'node']);
  });

  it('limits Project helpers to native Project selection, creation, and IDE launch', () => {
    expect(desktopProjectsApiKeys).toEqual(['createFolder', 'openInIde', 'selectFolder']);
  });

  it('limits terminal helpers to human-controlled terminal lifecycle and IO', () => {
    expect(desktopTerminalApiKeys).toEqual([
      'create',
      'input',
      'resize',
      'dispose',
      'onData',
      'onExit',
    ]);
  });

  it('limits workspace helpers to explicit WebView lifecycle actions', () => {
    expect(desktopWorkspaceApiKeys).toEqual([
      'openResource',
      'openExternalFallback',
      'openWebView',
      'closeWebView',
      'focusWebView',
      'listWebViews',
      'setWebViewBounds',
      'goBackWebView',
      'goForwardWebView',
      'reloadWebView',
      'onWebViewUpdated',
    ]);
  });

  it('does not include generic IPC, filesystem, shell, or path APIs', () => {
    const forbiddenRootKeys = ['invoke', 'send', 'on', 'fs', 'shell', 'path', 'ipc', 'ipcRenderer'];

    for (const key of forbiddenRootKeys) {
      expect(desktopBridgeApiKeys).not.toContain(key);
    }
  });

  it('keeps maintenance IPC channels scoped to explicit desktop actions', () => {
    expect(resetLocalDataConfirmationIpcChannel).toBe(
      'agent-platform:get-reset-local-data-confirmation',
    );
    expect(resetLocalDataIpcChannel).toBe('agent-platform:reset-local-data');
    expect(repairMacosVmRuntimeIpcChannel).toBe('agent-platform:repair-macos-vm-runtime');

    for (const channel of [
      resetLocalDataConfirmationIpcChannel,
      resetLocalDataIpcChannel,
      repairMacosVmRuntimeIpcChannel,
    ]) {
      expect(channel).toMatch(/^agent-platform:/);
      expect(channel).not.toContain('fs');
      expect(channel).not.toContain('shell');
      expect(channel).not.toContain('eval');
    }
  });

  it('keeps Project IPC channels scoped to explicit desktop actions', () => {
    expect(createProjectFolderIpcChannel).toBe('agent-platform:create-project-folder');
    expect(openProjectIdeIpcChannel).toBe('agent-platform:project:open-ide');
    expect(selectProjectFolderIpcChannel).toBe('agent-platform:select-project-folder');
    for (const channel of [
      createProjectFolderIpcChannel,
      openProjectIdeIpcChannel,
      selectProjectFolderIpcChannel,
    ]) {
      expect(channel).not.toContain('fs');
      expect(channel).not.toContain('shell');
      expect(channel).not.toContain('eval');
    }
  });

  it('keeps terminal IPC channels scoped to explicit terminal actions', () => {
    expect(createTerminalIpcChannel).toBe('agent-platform:terminal:create');
    expect(inputTerminalIpcChannel).toBe('agent-platform:terminal:input');
    expect(resizeTerminalIpcChannel).toBe('agent-platform:terminal:resize');
    expect(disposeTerminalIpcChannel).toBe('agent-platform:terminal:dispose');

    for (const channel of [
      createTerminalIpcChannel,
      inputTerminalIpcChannel,
      resizeTerminalIpcChannel,
      disposeTerminalIpcChannel,
    ]) {
      expect(channel).toMatch(/^agent-platform:terminal:/);
      expect(channel).not.toContain('eval');
    }
  });

  it('keeps workspace IPC channels scoped to explicit workspace actions', () => {
    expect(openWorkspaceResourceIpcChannel).toBe('agent-platform:workspace:open-resource');
    expect(openWorkspaceExternalFallbackIpcChannel).toBe(
      'agent-platform:workspace:open-external-fallback',
    );
    expect(openWorkspaceWebViewIpcChannel).toBe('agent-platform:workspace:open-webview');
    expect(closeWorkspaceWebViewIpcChannel).toBe('agent-platform:workspace:close-webview');
    expect(focusWorkspaceWebViewIpcChannel).toBe('agent-platform:workspace:focus-webview');
    expect(listWorkspaceWebViewsIpcChannel).toBe('agent-platform:workspace:list-webviews');
    expect(setWorkspaceWebViewBoundsIpcChannel).toBe('agent-platform:workspace:set-webview-bounds');
    expect(goBackWorkspaceWebViewIpcChannel).toBe('agent-platform:workspace:webview-back');
    expect(goForwardWorkspaceWebViewIpcChannel).toBe('agent-platform:workspace:webview-forward');
    expect(reloadWorkspaceWebViewIpcChannel).toBe('agent-platform:workspace:webview-reload');
    expect(workspaceWebViewUpdatedIpcChannel).toBe('agent-platform:workspace:webview-updated');

    for (const channel of [
      openWorkspaceResourceIpcChannel,
      openWorkspaceExternalFallbackIpcChannel,
      openWorkspaceWebViewIpcChannel,
      closeWorkspaceWebViewIpcChannel,
      focusWorkspaceWebViewIpcChannel,
      listWorkspaceWebViewsIpcChannel,
      setWorkspaceWebViewBoundsIpcChannel,
      goBackWorkspaceWebViewIpcChannel,
      goForwardWorkspaceWebViewIpcChannel,
      reloadWorkspaceWebViewIpcChannel,
      workspaceWebViewUpdatedIpcChannel,
    ]) {
      expect(channel).toMatch(/^agent-platform:workspace:/);
      expect(channel).not.toContain('fs');
      expect(channel).not.toContain('shell');
      expect(channel).not.toContain('eval');
    }
  });
});
