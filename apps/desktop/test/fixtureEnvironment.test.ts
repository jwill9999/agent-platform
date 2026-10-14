import { describe, expect, it } from 'vitest';
import { fixtureEnvironment } from '../e2e/support/fixtureEnvironment.js';

describe('trace-safe connected fixture environment', () => {
  const root = '/owned/fixture';
  const node = '/owned/node/bin/node';

  it('excludes named and unknown ambient credentials, proxies and execution hooks', () => {
    const source = Object.fromEntries(
      [
        'SONARQUBE_TOKEN',
        'CONTEXT7_API_KEY',
        'OPENROUTER_API_KEY',
        'GITHUB_PERSONAL_ACCESS_TOKEN',
        'LANGSMITH_API_KEY',
        'SECRETS_MASTER_KEY',
        'OPENAI_API_KEY',
        'AGENT_OPENAI_API_KEY',
        'UNRECOGNIZED_FUTURE_SECRET',
        'HTTP_PROXY',
        'HTTPS_PROXY',
        'NODE_OPTIONS',
        'SSH_AUTH_SOCK',
        'GH_CONFIG_DIR',
        'AGENT_PLATFORM_DIAGNOSTIC_CAPABILITY',
        'AGENT_PLATFORM_GH_BINARY',
        'AGENT_PLATFORM_DESKTOP_NODE_PATH',
        'ELECTRON_RUN_AS_NODE',
      ].map((key) => [key, `SYNTHETIC_PRIVATE_${key}`]),
    );
    const serializedLaunchEnvironment = JSON.stringify(fixtureEnvironment(root, node, source));
    expect(serializedLaunchEnvironment).not.toContain('SYNTHETIC_PRIVATE');
    for (const key of Object.keys(source)) {
      expect(fixtureEnvironment(root, node, source)).not.toHaveProperty(key);
    }
    expect(source.UNRECOGNIZED_FUTURE_SECRET).toBe('SYNTHETIC_PRIVATE_UNRECOGNIZED_FUTURE_SECRET');
  });

  it('uses owned homes, caches and temporary paths instead of ambient config locations', () => {
    const env = fixtureEnvironment(root, node, {
      HOME: '/unrelated/home',
      TMPDIR: '/unrelated/tmp',
      PATH: '/unrelated/bin',
      XDG_CONFIG_HOME: '/unrelated/config',
      GIT_CONFIG_GLOBAL: '/unrelated/gitconfig',
      LANGSMITH_TRACING: 'true',
    });
    expect(env).toMatchObject({
      PATH: '/owned/node/bin:/usr/bin:/bin:/usr/sbin:/sbin',
      HOME: '/owned/fixture/home',
      TMPDIR: '/owned/fixture/tmp',
      TMP: '/owned/fixture/tmp',
      TEMP: '/owned/fixture/tmp',
      XDG_CONFIG_HOME: '/owned/fixture/home/.config',
      XDG_CACHE_HOME: '/owned/fixture/home/.cache',
      XDG_DATA_HOME: '/owned/fixture/home/.local/share',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      LANGSMITH_TRACING: 'false',
      LANGSMITH_TRACING_V2: 'false',
      LANGCHAIN_TRACING_V2: 'false',
    });
    expect(JSON.stringify(env)).not.toContain('/unrelated');
  });

  it('preserves only explicit display-session wiring and omits absent values', () => {
    const env = fixtureEnvironment(root, node, {
      DISPLAY: ':99',
      WAYLAND_DISPLAY: 'wayland-0',
      XDG_RUNTIME_DIR: '/run/user/1000',
      DBUS_SESSION_BUS_ADDRESS: 'unix:path=/run/user/1000/bus',
      XAUTHORITY: '/owned/display-auth',
      FUTURE_ENVIRONMENT: 'not-forwarded',
    });
    expect(env).toMatchObject({
      DISPLAY: ':99',
      WAYLAND_DISPLAY: 'wayland-0',
      XDG_RUNTIME_DIR: '/run/user/1000',
      DBUS_SESSION_BUS_ADDRESS: 'unix:path=/run/user/1000/bus',
      XAUTHORITY: '/owned/display-auth',
    });
    expect(env).not.toHaveProperty('FUTURE_ENVIRONMENT');
    expect(
      fixtureEnvironment(root, node, { DISPLAY: '', XAUTHORITY: undefined }),
    ).not.toHaveProperty('DISPLAY');
  });
});
