import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type DesktopProjectBridge,
  hasDesktopProjectBridge,
  hasDesktopProjectIdeBridge,
  openDesktopProjectIde,
} from '@/lib/desktop-projects';

type DesktopGlobal = typeof globalThis & {
  agentPlatformDesktop?: DesktopProjectBridge;
};

describe('desktop Project bridge helpers', () => {
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    delete (globalThis as DesktopGlobal).agentPlatformDesktop;
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  });

  it('detects Project folder access separately from local IDE handoff', () => {
    (globalThis as DesktopGlobal).agentPlatformDesktop = {
      projects: {
        selectFolder: async () => ({ canceled: true }),
      },
    };

    expect(hasDesktopProjectBridge()).toBe(true);
    expect(hasDesktopProjectIdeBridge()).toBe(false);
  });

  it('detects local IDE handoff when the desktop bridge exposes openInIde', () => {
    (globalThis as DesktopGlobal).agentPlatformDesktop = {
      projects: {
        openInIde: async () => ({
          ok: true,
          handled: true,
          projectRoot: '/Users/test/project',
          opener: 'test',
        }),
        selectFolder: async () => ({ canceled: true }),
      },
    };

    expect(hasDesktopProjectBridge()).toBe(true);
    expect(hasDesktopProjectIdeBridge()).toBe(true);
  });

  it('returns null instead of calling unavailable local IDE handoff APIs', async () => {
    (globalThis as DesktopGlobal).agentPlatformDesktop = {
      projects: {
        selectFolder: async () => ({ canceled: true }),
      },
    };

    await expect(openDesktopProjectIde('project-1')).resolves.toBeNull();
  });
});
