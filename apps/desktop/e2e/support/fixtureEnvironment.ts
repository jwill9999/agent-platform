import { dirname, join } from 'node:path';

const DISPLAY_ENVIRONMENT_KEYS = [
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'XDG_RUNTIME_DIR',
  'DBUS_SESSION_BUS_ADDRESS',
  'XAUTHORITY',
] as const;

/**
 * Electron launch options are serialized into Playwright trace metadata. Build an
 * explicit fixture environment: never serialize or forward the developer/CI environment.
 * These inherited keys identify the OS display session only; application configuration,
 * provider credentials, proxies, Node hooks and Git/SSH identity are not inherited.
 */
export function fixtureEnvironment(
  root: string,
  nodePath: string,
  source: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const env: Record<string, string> = {
    PATH: [dirname(nodePath), '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':'),
    HOME: join(root, 'home'),
    TMPDIR: join(root, 'tmp'),
    TMP: join(root, 'tmp'),
    TEMP: join(root, 'tmp'),
    XDG_CONFIG_HOME: join(root, 'home', '.config'),
    XDG_CACHE_HOME: join(root, 'home', '.cache'),
    XDG_DATA_HOME: join(root, 'home', '.local', 'share'),
    LANG: 'C.UTF-8',
    TZ: 'UTC',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    LANGCHAIN_TRACING_V2: 'false',
    LANGSMITH_TRACING: 'false',
    LANGSMITH_TRACING_V2: 'false',
  };
  for (const key of DISPLAY_ENVIRONMENT_KEYS) {
    const value = source[key];
    if (value) env[key] = value;
  }
  return env;
}
