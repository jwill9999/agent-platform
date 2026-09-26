import { createHash } from 'node:crypto';
import { specialistRoleProfile, specialistSourceEvidence } from '../src/specialistRoleProfile.js';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, copyFile, chmod, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { it, expect } from 'vitest';
import {
  prepareSpecialistWorkspace,
  buildDockerSpecialistLaunch,
} from '../src/specialistLauncher.js';
import { DEFAULT_ROLE_OPERATION_POLICY } from '../src/authorization.js';
const run = promisify(execFile),
  image = process.env.WORKFLOW_ROLE_IMAGE;
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
  'captures enforced client tools for $name',
  async ({ name, role, operations }) => {
    const root = await mkdtemp(join(tmpdir(), 'role-tools-'));
    let privateRoot: string | undefined;
    try {
      await writeFile(join(root, 'source.txt'), 'original');
      await copyFile(
        new URL('./fixtures/roleCapabilityProbe.mjs', import.meta.url),
        join(root, 'probe.mjs'),
      );
      const staged = await prepareSpecialistWorkspace(root, ['.']);
      privateRoot = dirname(staged.root);
      const auth = join(privateRoot, 'auth.json'),
        prompt = join(privateRoot, 'prompt');
      await writeFile(auth, '{}');
      await writeFile(
        prompt,
        JSON.stringify({
          sourceEvidence: await specialistSourceEvidence(
            specialistRoleProfile(role, operations),
            staged.root,
          ),
          instruction: 'Use only the supplied source.',
        }),
      );
      const launch = await buildDockerSpecialistLaunch({
        image: image!,
        workspaceRoot: staged.root,
        codexHome: staged.codexHome,
        authFile: auth,
        promptFile: prompt,
        role,
        allowedOperations: operations,
        runId: 'role-tools',
        egressNetwork: 'none',
        containerUser: `${process.getuid!()}:${process.getgid!()}`,
      });
      for (const path of [
        staged.root,
        staged.codexHome,
        join(privateRoot, 'scratch'),
        join(privateRoot, 'evidence'),
      ])
        await chmod(path, 0o777);
      for (const path of [
        join(staged.codexHome, 'config.toml'),
        auth,
        prompt,
        join(staged.root, 'probe.mjs'),
      ])
        await chmod(path, 0o644);
      const args = launch.args.slice(0, -3);
      args.push('node', '/workspace/probe.mjs');
      let clientFailure: unknown;
      const { stdout, stderr } = await run(launch.dockerBinary, args, {
        env: {},
        timeout: 75000,
        maxBuffer: 300000,
      }).catch((error) => {
        clientFailure = String(error);
        return { stdout: error.stdout, stderr: error.stderr };
      });
      const result = JSON.parse(stdout);
      reports.push({
        name,
        role,
        operations,
        testedSource: await Promise.all(
          [
            '../src/authorization.ts',
            '../src/specialistRoleProfile.ts',
            '../src/specialistLauncher.ts',
            '../src/specialistSeccomp.ts',
            '../src/dockerDefaultSeccomp.json',
            './roleTools.integration.test.ts',
            './fixtures/roleCapabilityProbe.mjs',
          ].map(async (path) => ({
            path,
            sha256: createHash('sha256')
              .update(await readFile(new URL(path, import.meta.url)))
              .digest('hex'),
          })),
        ),
        configSha256: createHash('sha256')
          .update(await readFile(join(staged.codexHome, 'config.toml')))
          .digest('hex'),
        image,
        result,
        stderr,
        clientFailure,
        transport: 'deterministic offline Responses fixture; real Codex client',
      });
      if (process.env.WORKFLOW_ROLE_TOOL_REPORT)
        await writeFile(process.env.WORKFLOW_ROLE_TOOL_REPORT, JSON.stringify(reports, null, 2));
      expect(clientFailure).toBeUndefined();
      expect(result.clientExit).toEqual({ code: 0, signal: null });
      expect(result.completed).toBe(true);
      expect((await readFile(join(staged.root, 'source.txt'), 'utf8')).trim()).toBe(
        operations.includes('workspace.patch') ? 'modified' : 'original',
      );
      expect(result.deliveredSource).toEqual(
        operations.includes('process.test')
          ? null
          : {
              path: 'source.txt',
              content: 'original',
              sha256: createHash('sha256').update('original').digest('hex'),
            },
      );
      expect(result.requestCount).toBe(9);
      expect(result.effects).toEqual({
        patch: operations.includes('workspace.patch'),
        directPatch: operations.includes('workspace.patch'),
        evidencePatch: operations.includes('artifact.write'),
        direct: operations.includes('process.test'),
        scratch: operations.includes('process.test'),
        artifact: operations.includes('process.test') && operations.includes('artifact.write'),
      });
      expect(result.security).toEqual(
        operations.includes('process.test')
          ? {
              sourceRead: operations.includes('workspace.patch') ? 'modified\n' : 'original',
              sourceWrite: operations.includes('workspace.patch'),
              configWrite: false,
              authWrite: false,
              rootWrite: false,
              dockerSocket: false,
              network: false,
            }
          : null,
      );
      const reply = (id: string) =>
        JSON.stringify(result.outputs.find((x: { call_id: string }) => x.call_id === id)?.output);
      if (!operations.includes('workspace.patch')) {
        expect(reply('call_direct_patch')).toMatch(
          /read-only|outside of the project|Failed to write/,
        );
        expect(reply('call_patch')).toMatch(
          /disabled|read-only|outside of the project|Failed to write/,
        );
      }
      if (!operations.includes('process.test')) {
        expect(reply('call_direct')).toContain('unsupported call');
        expect(reply('call_shell')).toMatch(/disabled|not a function/);
        expect(reply('call_security')).toMatch(/disabled|not a function/);
      }
      if (!operations.includes('artifact.write'))
        expect(reply('call_evidence')).toMatch(/disabled|outside of the project|Failed to write/);
      expect(reply('call_mcp')).toMatch(/disabled|not a function/);
      const inventories = result.inventories.flat() as {
        name: string;
        tools?: { name: string; description?: string }[];
      }[];
      const top = [
        ...new Set(
          inventories.flatMap((g) => g.tools?.map((t) => `${g.name}.${t.name}`) ?? [g.name]),
        ),
      ].sort();
      expect(top).toEqual([
        'functions.exec',
        'functions.request_user_input',
        'functions.request_user_input_async',
        'functions.wait',
      ]);
      const nested = [
        ...new Set(
          inventories
            .flatMap((g) => g.tools ?? [])
            .filter((t) => t.name === 'exec')
            .flatMap((t) =>
              [...(t.description ?? '').matchAll(/^### `([^`]+)`/gm)].map((m) => m[1]),
            ),
        ),
      ].sort();
      // The pinned client advertises apply_patch even to readers. Its handler must deny writes.
      expect(nested).toEqual(
        operations.includes('process.test')
          ? ['apply_patch', 'clock__curr_time', 'exec_command', 'write_stdin']
          : ['apply_patch', 'clock__curr_time'],
      );
      expect(
        result.outputs.find((x: { call_id: string }) => x.call_id === 'call_spawn')?.output,
      ).toContain('unsupported call');
    } finally {
      await rm(root, { recursive: true, force: true });
      if (privateRoot) await rm(privateRoot, { recursive: true, force: true });
    }
  },
  80000,
);
