import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import {
  specialistRoleProfile,
  specialistRoleConfig,
  collectSpecialistEvidence,
} from '../src/specialistRoleProfile.js';
import { DEFAULT_ROLE_OPERATION_POLICY } from '../src/authorization.js';
import {
  prepareSpecialistWorkspace,
  buildDockerSpecialistLaunch,
} from '../src/specialistLauncher.js';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
it('rejects unknown/coordinator roles and over-ceiling grants; grant subsets reduce access', () => {
  expect(() => specialistRoleProfile('other', ['workspace.read'])).toThrow();
  expect(() => specialistRoleProfile('workflow_orchestrator', ['workspace.read'])).toThrow(
    'coordinator',
  );
  expect(() =>
    specialistRoleProfile('code_reviewer', ['workspace.read', 'workspace.patch']),
  ).toThrow('exceed');
  for (const [role, ops] of Object.entries(DEFAULT_ROLE_OPERATION_POLICY)) {
    if (role === 'workflow_orchestrator') continue;
    const p = specialistRoleProfile(role, ops);
    expect(p.patch).toBe(role === 'implementation_worker');
    expect(specialistRoleConfig(p)).toContain('[mcp_servers]');
    expect(specialistRoleConfig(p)).toContain('plugins = false');
    expect(specialistRoleProfile(role, ['workspace.read']).patch).toBe(false);
  }
  expect(
    specialistRoleProfile('implementation_worker', ['workspace.read', 'workspace.patch']),
  ).toMatchObject({ patch: true, test: false, artifacts: false });
  expect(specialistRoleProfile('test_runner', ['workspace.read', 'process.test'])).toMatchObject({
    patch: false,
    test: true,
    artifacts: false,
  });
});
it('strips nested project/MCP config and env variants; rejects explicit aliases', async () => {
  const root = await mkdtemp(join(tmpdir(), 'role-source-'));
  roots.push(root);
  await mkdir(join(root, '.codex'));
  await mkdir(join(root, 'nested', '.agents'), { recursive: true });
  await writeFile(join(root, '.codex', 'config.toml'), '[mcp_servers.inherited]\ncommand="unsafe"');
  await writeFile(join(root, '.env.local'), 'private');
  await writeFile(join(root, 'ok.txt'), 'visible');
  await symlink(join(root, '.codex', 'config.toml'), join(root, 'alias.txt'));
  await expect(prepareSpecialistWorkspace(root, ['alias.txt'])).rejects.toThrow('symlinks');
  const staged = await prepareSpecialistWorkspace(root, ['.']);
  roots.push(dirname(staged.root));
  await expect(readFile(join(staged.root, '.env.local'))).rejects.toThrow();
  await expect(readFile(join(staged.root, '.codex', 'config.toml'))).rejects.toThrow();
  const evidence = await collectSpecialistEvidence(staged.root);
  expect(evidence).toHaveLength(1);
  expect(evidence[0]?.content).toBe('visible');
  await writeFile(join(staged.root, 'binary'), Buffer.from([0, 1]));
  await expect(collectSpecialistEvidence(staged.root)).rejects.toThrow('binary');
});
it('rejects production environment overrides before files or credentials are touched', async () => {
  await expect(
    buildDockerSpecialistLaunch({
      image: 'unused',
      workspaceRoot: '/missing',
      codexHome: '/missing',
      authFile: '/missing',
      promptFile: '/missing',
      role: 'code_reviewer',
      allowedOperations: ['workspace.read'],
      runId: 'run',
      egressNetwork: 'isolated',
      containerUser: `${process.getuid!()}:${process.getgid!()}`,
      extraEnvironment: { CODEX_HOME: '/inherited' },
    }),
  ).rejects.toThrow('environment override');
});

it('rejects incompatible staging ownership and symlinked output/selector files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'role-owned-'));
  roots.push(root);
  await writeFile(join(root, 'source.txt'), 'source');
  const staged = await prepareSpecialistWorkspace(root, ['.']);
  const privateRoot = dirname(staged.root);
  roots.push(privateRoot);
  const auth = join(privateRoot, 'auth.json'),
    prompt = join(privateRoot, 'prompt');
  await writeFile(auth, '{}');
  await writeFile(prompt, 'test');
  const request = {
    image: 'test',
    workspaceRoot: staged.root,
    codexHome: staged.codexHome,
    authFile: auth,
    promptFile: prompt,
    role: 'implementation_worker',
    allowedOperations: ['workspace.read', 'workspace.patch'],
    runId: 'test',
    egressNetwork: 'none',
    containerUser: `${process.getuid!()}:${process.getgid!()}`,
  };
  await expect(
    buildDockerSpecialistLaunch({ ...request, containerUser: '60001:60001' }),
  ).rejects.toThrow('staging owner');
  const original = await readFile(join(staged.codexHome, 'config.toml'), 'utf8');
  expect(original).toContain('approval_policy');
  await symlink(root, join(privateRoot, 'scratch'));
  await expect(buildDockerSpecialistLaunch(request)).rejects.toThrow('output directory');
  await rm(join(privateRoot, 'scratch'));
  await symlink(join(root, 'source.txt'), join(privateRoot, 'specialist-seccomp.json'));
  await expect(buildDockerSpecialistLaunch(request)).rejects.toThrow('EEXIST');
  expect(await readFile(join(root, 'source.txt'), 'utf8')).toBe('source');
});
