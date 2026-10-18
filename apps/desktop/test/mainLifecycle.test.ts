import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (...args: unknown[]) => unknown>(),
  quit: vi.fn(),
  backend: vi.fn(),
  renderer: vi.fn(),
  secrets: vi.fn(),
  windows: vi.fn(),
}));
vi.mock('electron', () => ({
  app: {
    on: (event: string, callback: (...args: unknown[]) => unknown) =>
      mocks.listeners.set(event, callback),
    quit: mocks.quit,
    getVersion: () => 'test',
  },
  BrowserWindow: mocks.windows,
  dialog: {},
  ipcMain: { removeHandler: vi.fn(), handle: vi.fn() },
  safeStorage: {},
  shell: {},
  WebContentsView: vi.fn(),
}));
vi.mock('node-pty', () => ({ spawn: vi.fn() }));
vi.mock('../src/main/backendSupervisor.js', () => ({
  getDesktopBackendPaths: () => ({}),
  repairPackagedMacosVmRuntime: vi.fn(),
  resolveDesktopBackendNodePath: () => 'node',
  resolveDesktopBackendMode: () => 'managed',
  startDesktopBackend: mocks.backend,
}));
vi.mock('../src/main/rendererServer.js', () => ({
  getRepoRootFromMainDir: () => '/fixture',
  getStandaloneRendererPaths: () => ({}),
  resolveDesktopDevServerUrl: () => 'http://localhost',
  resolveDesktopRendererMode: () => 'standalone',
  startStandaloneRenderer: mocks.renderer,
}));
vi.mock('../src/main/secretStorage.js', () => ({
  createElectronSafeStorageProtector: () => ({}),
  ensureDesktopSecretsMasterKey: mocks.secrets,
}));
vi.mock('../src/main/runtimePaths.js', () => ({
  ensureDesktopRuntimeDirectories: vi.fn(),
  resolveDesktopRuntimePathsFromApp: () => ({ secretsMasterKeyPath: '/fixture/key' }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
function quit() {
  const event = { preventDefault: vi.fn() };
  mocks.listeners.get('before-quit')?.(event);
  expect(event.preventDefault).toHaveBeenCalledOnce();
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.listeners.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.secrets.mockResolvedValue({ masterKeyB64: 'fixture' });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Electron main startup and quit wiring', () => {
  it('prevents the first and repeated quit while secrets are pending; does not spawn after cancellation', async () => {
    const secrets = deferred<{ masterKeyB64: string }>();
    mocks.secrets.mockReturnValue(secrets.promise);
    await import('../src/main/main.js');
    mocks.listeners.get('ready')?.();
    await flush();
    quit();
    quit();
    expect(mocks.quit).not.toHaveBeenCalled();
    secrets.resolve({ masterKeyB64: 'fixture' });
    await flush();
    expect(mocks.backend).not.toHaveBeenCalled();
    expect(mocks.windows).not.toHaveBeenCalled();
    expect(mocks.quit).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"phase":"stop-confirmed"'));
    const finalQuit = { preventDefault: vi.fn() };
    mocks.listeners.get('before-quit')?.(finalQuit);
    expect(finalQuit.preventDefault).not.toHaveBeenCalled();
  });

  it('cancels backend readiness and joins its cleanup before allowing exit', async () => {
    const backend = deferred<{ url: string; stop: () => Promise<void> }>();
    const stopped = deferred<void>();
    const stop = vi.fn(() => stopped.promise);
    mocks.backend.mockReturnValue(backend.promise);
    await import('../src/main/main.js');
    mocks.listeners.get('ready')?.();
    await flush();
    const signal = mocks.backend.mock.calls[0]?.[0].signal as AbortSignal;
    quit();
    expect(signal.aborted).toBe(true);
    backend.resolve({ url: 'http://fixture', stop });
    await flush();
    expect(stop).toHaveBeenCalledOnce();
    expect(mocks.renderer).not.toHaveBeenCalled();
    expect(mocks.quit).not.toHaveBeenCalled();
    stopped.resolve();
    await flush();
    expect(mocks.quit).toHaveBeenCalledOnce();
  });

  it('reclaims a renderer that resolves after quit without creating a window', async () => {
    const backendStop = vi.fn(async () => {});
    mocks.backend.mockResolvedValue({ url: 'http://fixture', stop: backendStop });
    const renderer = deferred<{ url: string; stop: () => Promise<void> }>();
    const rendererStop = vi.fn(async () => {});
    mocks.renderer.mockReturnValue(renderer.promise);
    await import('../src/main/main.js');
    mocks.listeners.get('ready')?.();
    await flush();
    quit();
    renderer.resolve({ url: 'http://renderer', stop: rendererStop });
    await flush();
    expect(mocks.windows).not.toHaveBeenCalled();
    expect(backendStop).toHaveBeenCalledOnce();
    expect(rendererStop).toHaveBeenCalledOnce();
    expect(mocks.quit).toHaveBeenCalledOnce();
  });

  it('waits for both ready children during normal shutdown', async () => {
    const backendStopped = deferred<void>();
    const backendStop = vi.fn(() => backendStopped.promise);
    const rendererStop = vi.fn(async () => {});
    mocks.backend.mockResolvedValue({ url: 'http://fixture', stop: backendStop });
    mocks.renderer.mockResolvedValue({ url: 'http://renderer', stop: rendererStop });
    const getURL = vi.fn(() => 'http://renderer');
    mocks.windows.mockImplementation(function () {
      return {
        loadURL: async () => {},
        once: vi.fn(),
        webContents: { setWindowOpenHandler: vi.fn(), on: vi.fn(), getURL },
      };
    });
    await import('../src/main/main.js');
    mocks.listeners.get('ready')?.();
    await flush();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"phase":"window-ready"'));
    expect(getURL).toHaveBeenCalledOnce();
    expect(console.error).not.toHaveBeenCalledWith(
      'Failed to start Agent Platform desktop shell. Retain runtime diagnostics.',
    );
    expect(mocks.quit).not.toHaveBeenCalled();
    quit();
    quit();
    await flush();
    expect(backendStop).toHaveBeenCalledOnce();
    expect(rendererStop).toHaveBeenCalledOnce();
    expect(mocks.quit).not.toHaveBeenCalled();
    backendStopped.resolve();
    await flush();
    expect(mocks.quit).toHaveBeenCalledOnce();
  });

  it('destroys a window still loading when quit cancels startup', async () => {
    const loaded = deferred<void>();
    const destroy = vi.fn(() => loaded.resolve());
    const stop = vi.fn(async () => {});
    mocks.backend.mockResolvedValue({ url: 'http://fixture', stop });
    mocks.renderer.mockResolvedValue({ url: 'http://renderer', stop });
    mocks.windows.mockImplementation(function () {
      return {
        loadURL: () => loaded.promise,
        isDestroyed: () => false,
        destroy,
        webContents: { setWindowOpenHandler: vi.fn(), on: vi.fn() },
      };
    });
    await import('../src/main/main.js');
    mocks.listeners.get('ready')?.();
    await flush();
    quit();
    await flush();
    expect(destroy).toHaveBeenCalledOnce();
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('"phase":"window-ready"'),
    );
    expect(mocks.quit).toHaveBeenCalledOnce();
  });

  it('keeps exit unconfirmed when child reclamation fails', async () => {
    const backend = deferred<{ url: string; stop: () => Promise<void> }>();
    mocks.backend.mockReturnValue(backend.promise);
    await import('../src/main/main.js');
    mocks.listeners.get('ready')?.();
    await flush();
    quit();
    backend.resolve({
      url: 'http://fixture',
      stop: async () => {
        throw new Error('unconfirmed');
      },
    });
    await flush();
    expect(mocks.quit).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"phase":"stop-failed"'));
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('"phase":"stop-confirmed"'),
    );
  });
});
