import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, chmod, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import {
  prepareSpecialistWorkspace,
  buildDockerSpecialistLaunch,
} from '../src/specialistLauncher.js';
import { DEFAULT_ROLE_OPERATION_POLICY } from '../src/authorization.js';
import { specialistRoleProfile } from '../src/specialistRoleProfile.js';
const image = process.env.WORKFLOW_ROLE_IMAGE;
const run = promisify(execFile);
const cases = Object.entries(DEFAULT_ROLE_OPERATION_POLICY)
  .filter(([r]) => r !== 'workflow_orchestrator')
  .map(([role, operations]) => ({ name: role, role, operations }));
for (const [name, operations] of Object.entries({
  read: ['workspace.read'],
  patch: ['workspace.read', 'workspace.patch'],
  test: ['workspace.read', 'process.test'],
  artifact: ['workspace.read', 'artifact.write'],
}))
  cases.push({
    name: 'implementation_' + name,
    role: 'implementation_worker',
    operations: operations as (typeof cases)[number]['operations'],
  });
const reports: unknown[] = [];
it.skipIf(!image).each(cases)(
  'enforces actual container access for $name',
  async ({ name, role, operations }) => {
    const root = await mkdtemp(join(tmpdir(), 'role-probe-'));
    let stagedRoot: string | undefined;
    try {
      await mkdir(join(root, '.codex'));
      await writeFile(
        join(root, '.codex', 'config.toml'),
        '[mcp_servers.unapproved]\ncommand="touch"\nargs=["/tmp/inherited-mcp"]',
      );
      await writeFile(join(root, 'source.txt'), 'original');
      const staged = await prepareSpecialistWorkspace(root, ['.']);
      stagedRoot = dirname(staged.root);
      const auth = join(stagedRoot, 'auth.json'),
        prompt = join(stagedRoot, 'prompt.txt');
      await writeFile(auth, '{}');
      await writeFile(prompt, 'fixture');
      const launch = await buildDockerSpecialistLaunch({
        image: image!,
        workspaceRoot: staged.root,
        codexHome: staged.codexHome,
        authFile: auth,
        promptFile: prompt,
        role,
        allowedOperations: operations,
        runId: 'role-probe',
        egressNetwork: 'none',
        containerUser: `${process.getuid!()}:${process.getgid!()}`,
      });
      // Fixture permissions deliberately allow writes at the Unix layer; Docker mount policy must deny them.
      for (const p of [
        staged.root,
        staged.codexHome,
        join(stagedRoot, 'scratch'),
        join(stagedRoot, 'evidence'),
      ])
        await chmod(p, 0o777);
      for (const p of [
        join(staged.root, 'source.txt'),
        join(staged.codexHome, 'config.toml'),
        auth,
        prompt,
      ])
        await chmod(p, 0o666);
      const args = launch.args.slice(0, -3);
      args.push(
        'node',
        '-e',
        String.raw`
const fs=require('fs'),cp=require('child_process');
const attempt=(p)=>{try{fs.writeFileSync(p,'changed');return true;}catch(e){if(!['EROFS','EACCES','EPERM'].includes(e.code))throw e;return false;}};
const original=fs.readFileSync('/workspace/source.txt','utf8');
const result={read:original,patch:attempt('/workspace/source.txt'),scratch:attempt('/scratch/test-output'),artifact:attempt('/evidence/result.json'),configWrite:attempt('/codex-home/config.toml'),projectConfig:fs.existsSync('/workspace/.codex/config.toml'),dockerSocket:fs.existsSync('/var/run/docker.sock'),home:process.env.HOME};
result.capEff=fs.readFileSync('/proc/self/status','utf8').match(/^CapEff:\s*(\w+)/m)[1];
result.noNewPrivileges=fs.readFileSync('/proc/self/status','utf8').match(/^NoNewPrivs:\s*(\d+)/m)[1];
result.mcp=cp.execFileSync('/usr/local/bin/codex',['mcp','list','--json'],{encoding:'utf8'}).trim();
console.log(JSON.stringify(result));`,
      );
      const { stdout } = await run(launch.dockerBinary, args, {
        env: {},
        timeout: 20000,
        maxBuffer: 100000,
      });
      const result = JSON.parse(stdout);
      const profile = specialistRoleProfile(role, operations);
      expect(result).toMatchObject({
        capEff: '0000000000000000',
        noNewPrivileges: '1',
        read: 'original',
        patch: profile.patch,
        scratch: profile.test,
        artifact: profile.artifacts,
        configWrite: false,
        projectConfig: false,
        dockerSocket: false,
        home: '/codex-home',
      });
      expect(JSON.parse(result.mcp)).toEqual([]);
      expect(await readFile(join(root, 'source.txt'), 'utf8')).toBe('original');
      reports.push({
        name,
        role,
        operations,
        result,
        image,
        model: 'none; real Docker/CLI offline probe',
      });
      if (process.env.WORKFLOW_ROLE_REPORT)
        await writeFile(process.env.WORKFLOW_ROLE_REPORT, JSON.stringify(reports, null, 2));
    } finally {
      await rm(root, { recursive: true, force: true });
      if (stagedRoot) await rm(stagedRoot, { recursive: true, force: true });
    }
  },
  30000,
);

it.skipIf(!image)(
  'launches with actual production staging permissions and matching uid without chmod',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'role-production-'));
    let privateRoot: string | undefined;
    try {
      await writeFile(join(root, 'source.txt'), 'original');
      const staged = await prepareSpecialistWorkspace(root, ['.']);
      privateRoot = dirname(staged.root);
      const auth = join(privateRoot, 'auth.json'),
        prompt = join(privateRoot, 'prompt');
      await writeFile(auth, '{}', { mode: 0o600 });
      await writeFile(prompt, 'test', { mode: 0o600 });
      const launch = await buildDockerSpecialistLaunch({
        image: image!,
        workspaceRoot: staged.root,
        codexHome: staged.codexHome,
        authFile: auth,
        promptFile: prompt,
        role: 'test_runner',
        allowedOperations: ['workspace.read', 'process.test', 'artifact.write'],
        runId: 'test',
        egressNetwork: 'none',
      });
      const args = launch.args.slice(0, -3);
      args.push(
        'node',
        '-e',
        `const fs=require('fs');for(const p of ['/workspace/source.txt','/codex-home/config.toml','/codex-home/auth.json','/run/specialist/prompt.txt'])fs.readFileSync(p);fs.writeFileSync('/scratch/result','test');fs.writeFileSync('/evidence/result','evidence');console.log('production permissions passed');`,
      );
      const result = await run(launch.dockerBinary, args, {
        env: {},
        timeout: 20000,
        maxBuffer: 100000,
      });
      expect(result.stdout).toContain('production permissions passed');
      reports.push({
        name: 'production_staging_permissions',
        image,
        uid: process.getuid!(),
        mode: 'no chmod, real production staging',
        result: result.stdout.trim(),
      });
      if (process.env.WORKFLOW_ROLE_REPORT)
        await writeFile(process.env.WORKFLOW_ROLE_REPORT, JSON.stringify(reports, null, 2));
    } finally {
      await rm(root, { recursive: true, force: true });
      if (privateRoot) await rm(privateRoot, { recursive: true, force: true });
    }
  },
  30000,
);
