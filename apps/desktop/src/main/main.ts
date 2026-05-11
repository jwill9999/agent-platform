import { app, BrowserWindow } from 'electron';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBootstrapHtml, createWindowOptions, getPreloadPath } from './windowConfig.js';

const smokeMode = process.argv.includes('--smoke');
let mainWindow: BrowserWindow | undefined;

export async function createMainWindow(): Promise<BrowserWindow> {
  const mainDir = dirname(fileURLToPath(import.meta.url));
  const window = new BrowserWindow(createWindowOptions(getPreloadPath(mainDir)));

  mainWindow = window;
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildBootstrapHtml())}`);

  if (process.env.AGENT_PLATFORM_DESKTOP_DEVTOOLS === '1') {
    window.webContents.openDevTools({ mode: 'detach' });
  }

  if (smokeMode) {
    window.close();
    app.quit();
  }

  return window;
}

function focusMainWindow(): void {
  if (mainWindow?.isDestroyed() === false) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
}

async function bootstrap(): Promise<void> {
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
      return;
    }

    focusMainWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

void app
  .whenReady()
  .then(bootstrap)
  .catch((error: unknown) => {
    console.error('Failed to start Agent Platform desktop shell.', error);
    app.quit();
  });
