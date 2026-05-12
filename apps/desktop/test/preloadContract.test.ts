import { describe, expect, it } from 'vitest';

import {
  desktopBridgeApiKeys,
  desktopBridgeApiName,
  desktopMaintenanceApiKeys,
  desktopVersionsApiKeys,
} from '../src/preload/desktopBridge.js';

describe('desktop preload bridge contract', () => {
  it('uses a single named desktop API surface', () => {
    expect(desktopBridgeApiName).toBe('agentPlatformDesktop');
  });

  it('limits the root bridge keys to the explicit contract', () => {
    expect(desktopBridgeApiKeys).toEqual(['maintenance', 'versions']);
  });

  it('limits maintenance helpers to explicit destructive actions', () => {
    expect(desktopMaintenanceApiKeys).toEqual(['getResetLocalDataConfirmation', 'resetLocalData']);
  });

  it('limits version helpers to runtime version readers', () => {
    expect(desktopVersionsApiKeys).toEqual(['chrome', 'electron', 'node']);
  });

  it('does not include generic IPC, filesystem, shell, or path APIs', () => {
    const forbiddenRootKeys = ['invoke', 'send', 'on', 'fs', 'shell', 'path', 'ipc', 'ipcRenderer'];

    for (const key of forbiddenRootKeys) {
      expect(desktopBridgeApiKeys).not.toContain(key);
    }
  });
});
