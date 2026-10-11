import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { prepareSupervisedReview } from '../src/supervisedReview.js';

const image = process.env.WORKFLOW_REVIEW_IMAGE;
it.skipIf(!image)(
  'the pinned Codex runtime disables account apps and execution tools',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'review-config-probe-'));
    let staged: string | undefined;
    try {
      await writeFile(join(root, 'plan.md'), 'test evidence');
      await writeFile(join(root, 'auth.json'), '{}', { mode: 0o600 });
      const prepared = await prepareSupervisedReview({
        sourceRoot: root,
        evidencePaths: ['plan.md'],
        modelAuthFile: join(root, 'auth.json'),
        image: image!,
        egressNetwork: 'probe-only',
        question: 'Offline probe',
      });
      staged = dirname(prepared.snapshot.root);
      const args = prepared.launch.args.slice(0, -3);
      args[args.indexOf('--network') + 1] = 'none';
      args.push('codex', 'features', 'list');
      const { stdout } = await promisify(execFile)(prepared.launch.dockerBinary, args, {
        env: {},
        timeout: 15000,
        maxBuffer: 20000,
      });
      const flags = new Map(
        stdout
          .trim()
          .split('\n')
          .map((line) => {
            const values = line.trim().split(/\s+/u);
            return [values[0], values.at(-1)];
          }),
      );
      // unified_exec is normalized on by this runtime; shell_tool controls tool exposure.
      // Do not represent the engine flag itself as disabled.
      for (const flag of [
        'apps',
        'plugins',
        'remote_plugin',
        'browser_use',
        'computer_use',
        'multi_agent',
        'shell_tool',
        'skill_mcp_dependency_install',
      ]) {
        expect(flags.get(flag), flag).toBe('false');
      }
    } finally {
      await rm(root, { recursive: true, force: true });
      if (staged) await rm(staged, { recursive: true, force: true });
    }
  },
  20000,
);
