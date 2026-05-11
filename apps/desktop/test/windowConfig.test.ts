import { describe, expect, it } from 'vitest';

import {
  buildBootstrapHtml,
  createWindowOptions,
  getPreloadPath,
} from '../src/main/windowConfig.js';

describe('desktop window configuration', () => {
  it('uses a constrained renderer security boundary', () => {
    const options = createWindowOptions('/app/dist/preload/preload.js');

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      preload: '/app/dist/preload/preload.js',
      sandbox: true,
    });
  });

  it('resolves the compiled preload script beside the main bundle', () => {
    expect(getPreloadPath('/app/dist/main')).toBe('/app/dist/preload/preload.js');
  });

  it('renders a minimal bootstrap shell until the web renderer is wired', () => {
    const html = buildBootstrapHtml();

    expect(html).toContain('<title>Agent Platform</title>');
    expect(html).toContain('Desktop shell is ready');
  });
});
