import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterAll, describe, expect, it } from 'vitest';

import { prepareSpecialistWorkspace } from '../src/index.js';

const run = promisify(execFile);
const roots: string[] = [];
const integration = process.env.WORKFLOW_DOCKER_ISOLATION === '1' ? describe : describe.skip;

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

integration('malicious specialist feasibility', () => {
  it('cannot observe host control, credential, repository, or broker surfaces', async () => {
    const source = await mkdtemp(join(tmpdir(), 'workflow-malicious-source-'));
    roots.push(source);
    await Promise.all([
      mkdir(join(source, '.git')),
      mkdir(join(source, '.beads')),
      mkdir(join(source, '.ssh')),
    ]);
    await Promise.all([
      writeFile(join(source, '.git', 'config'), 'credential = secret'),
      writeFile(join(source, '.beads', 'config'), 'write_endpoint = secret'),
      writeFile(join(source, '.ssh', 'id_ed25519'), 'secret'),
      writeFile(join(source, '.env'), 'GITHUB_TOKEN=secret'),
      writeFile(join(source, 'allowed.txt'), 'visible'),
    ]);
    const specialist = await prepareSpecialistWorkspace(source, ['allowed.txt']);
    roots.push(join(specialist.root, '..'));
    await chmod(join(specialist.root, '..'), 0o755);
    await chmod(specialist.root, 0o755);
    await chmod(join(specialist.root, 'allowed.txt'), 0o644);

    const probe = String.raw`
      const fs = require('node:fs');
      const forbidden = [
        '/workspace/.git', '/workspace/.beads', '/workspace/.ssh', '/workspace/.env',
        '/var/run/docker.sock', '/run/workflow-broker.sock', '/Users/letuscode/.codex',
        '/Users/letuscode/Library/Keychains'
      ];
      const leakedEnv = Object.keys(process.env).filter((key) =>
        /TOKEN|SECRET|PASSWORD|CREDENTIAL|DOCKER|SSH_AUTH_SOCK|GITHUB|GH_/.test(key)
      );
      const result = {
        allowedVisible: fs.readFileSync('/workspace/allowed.txt', 'utf8') === 'visible',
        forbiddenVisible: forbidden.filter((path) => fs.existsSync(path)),
        leakedEnv,
        uid: process.getuid?.()
      };
      process.stdout.write(JSON.stringify(result));
    `;
    const { stdout } = await run(
      '/usr/local/bin/docker',
      [
        'run',
        '--rm',
        '--network',
        'none',
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--pids-limit',
        '64',
        '--memory',
        '256m',
        '--cpus',
        '1',
        '--tmpfs',
        '/tmp:rw,nosuid,nodev,noexec,size=16m',
        '--volume',
        `${specialist.root}:/workspace:ro`,
        '--workdir',
        '/workspace',
        process.env.WORKFLOW_DOCKER_IMAGE ?? 'agent-platform-api:latest',
        'node',
        '-e',
        probe,
      ],
      {
        env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin' },
        timeout: 30_000,
        maxBuffer: 64 * 1024,
      },
    );
    const result = JSON.parse(stdout) as {
      allowedVisible: boolean;
      forbiddenVisible: string[];
      leakedEnv: string[];
      uid?: number;
    };
    expect(result).toEqual({
      allowedVisible: true,
      forbiddenVisible: [],
      leakedEnv: [],
      uid: expect.any(Number),
    });
    expect(result.uid).not.toBe(0);
  }, 45_000);
});
