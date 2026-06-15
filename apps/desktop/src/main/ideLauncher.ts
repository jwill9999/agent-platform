import { spawn } from 'node:child_process';
import type { Shell } from 'electron';

export type DesktopIdeLaunchResult =
  | {
      readonly ok: true;
      readonly handled: true;
      readonly projectRoot: string;
      readonly opener: string;
    }
  | {
      readonly ok: true;
      readonly handled: false;
      readonly reason: string;
    };

type LaunchAttempt = Readonly<{
  command: string;
  args: readonly string[];
  opener: string;
}>;

export async function openProjectRootInIde(input: {
  readonly projectRoot: string | undefined;
  readonly env: NodeJS.ProcessEnv;
  readonly platform: NodeJS.Platform;
  readonly shell: Pick<Shell, 'openPath'>;
}): Promise<DesktopIdeLaunchResult> {
  const projectRoot = input.projectRoot?.trim();
  if (!projectRoot) {
    return { ok: true, handled: false, reason: 'Project folder is unavailable.' };
  }

  if (input.env.AGENT_PLATFORM_DESKTOP_TEST_OPEN_IDE === '1') {
    return { ok: true, handled: true, projectRoot, opener: 'test' };
  }

  const preferredCommand = input.env.AGENT_PLATFORM_DESKTOP_IDE_COMMAND?.trim();
  const attempts = [
    ...(preferredCommand
      ? [{ command: preferredCommand, args: [projectRoot], opener: preferredCommand }]
      : []),
    ...defaultIdeLaunchAttempts(projectRoot, input.platform),
  ];

  for (const attempt of attempts) {
    if (await tryLaunch(attempt)) {
      return { ok: true, handled: true, projectRoot, opener: attempt.opener };
    }
  }

  const openPathError = await input.shell.openPath(projectRoot);
  if (!openPathError) {
    return { ok: true, handled: true, projectRoot, opener: 'system' };
  }

  return {
    ok: true,
    handled: false,
    reason: `No IDE launcher succeeded. System fallback failed: ${openPathError}`,
  };
}

function defaultIdeLaunchAttempts(projectRoot: string, platform: NodeJS.Platform): LaunchAttempt[] {
  const cliAttempts = ['code', 'cursor', 'windsurf', 'zed'].map((command) => ({
    command,
    args: [projectRoot],
    opener: command,
  }));

  if (platform !== 'darwin') return cliAttempts;

  return [
    {
      command: 'open',
      args: ['-a', 'Visual Studio Code', projectRoot],
      opener: 'Visual Studio Code',
    },
    { command: 'open', args: ['-a', 'Cursor', projectRoot], opener: 'Cursor' },
    { command: 'open', args: ['-a', 'Windsurf', projectRoot], opener: 'Windsurf' },
    { command: 'open', args: ['-a', 'Zed', projectRoot], opener: 'Zed' },
    ...cliAttempts,
  ];
}

function tryLaunch(attempt: LaunchAttempt): Promise<boolean> {
  return new Promise((resolveLaunch) => {
    const child = spawn(attempt.command, [...attempt.args], {
      detached: true,
      stdio: 'ignore',
    });
    child.once('error', () => resolveLaunch(false));
    child.once('spawn', () => {
      child.unref();
      resolveLaunch(true);
    });
  });
}
