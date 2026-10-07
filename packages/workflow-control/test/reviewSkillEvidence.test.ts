import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
  access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { captureCommittedReviewSkills } from '../src/reviewSkillEvidence.js';
import { prepareReviewSnapshot, prepareSupervisedReview } from '../src/supervisedReview.js';
import { prepareSpecialistWorkspace } from '../src/specialistLauncher.js';

const cleanup: string[] = [];
const skill = '.agents/skills/example/SKILL.md';
const gitBinary = process.env.WORKFLOW_GIT_BINARY ?? '/usr/bin/git';
function git(root: string, ...args: string[]) {
  return execFileSync(gitBinary, ['-C', root, ...args], {
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  })
    .toString()
    .trim();
}
async function source(content: string | Buffer = 'committed skill text') {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'skill-review-test-')));
  cleanup.push(root);
  await mkdir(dirname(join(root, skill)), { recursive: true });
  await writeFile(join(root, skill), content);
  await writeFile(join(root, 'plan.md'), 'ordinary evidence');
  git(root, 'init', '-q');
  git(root, 'add', '.');
  git(
    root,
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.invalid',
    'commit',
    '-qm',
    'fixture',
  );
  return root;
}
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
it.each([false, true])(
  'stages committed skill as inert evidence with an auditable mapping (mixed=%s)',
  async (mixed) => {
    const root = await source();
    await writeFile(join(root, skill), 'uncommitted replacement');
    const snapshot = await prepareReviewSnapshot(root, mixed ? [skill, 'plan.md'] : [skill]);
    cleanup.push(dirname(snapshot.root));
    const entry = snapshot.manifest.find((item) => item.path === skill)!;
    expect(entry.sourceRevision).toBe(git(root, 'rev-parse', 'HEAD'));
    expect(entry.digest).toBe(createHash('sha256').update('committed skill text').digest('hex'));
    expect(entry.stagedPath).toMatch(/^review-skill-evidence\/[a-f0-9]{64}\.txt$/u);
    expect(await readFile(join(snapshot.root, entry.stagedPath!), 'utf8')).toBe(
      'committed skill text',
    );
    await expect(access(join(snapshot.root, '.agents'))).rejects.toThrow();
    await expect(access(join(snapshot.codexHome, 'skills'))).rejects.toThrow();
    expect(snapshot.manifest).toHaveLength(mixed ? 2 : 1);
    await expect(prepareSpecialistWorkspace(root, [skill])).rejects.toThrow();
  },
);
it('cannot redirect immutable skill reads by swapping the live ancestor', async () => {
  const root = await source();
  const outside = await realpath(await mkdtemp(join(tmpdir(), 'skill-outside-')));
  cleanup.push(outside);
  await mkdir(join(outside, 'skills/example'), { recursive: true });
  await writeFile(join(outside, 'skills/example/SKILL.md'), 'private unrelated content');
  await rm(join(root, '.agents'), { recursive: true });
  await symlink(outside, join(root, '.agents'));
  expect(captureCommittedReviewSkills(root, [skill])[0]!.bytes.toString()).toBe(
    'committed skill text',
  );
  await expect(prepareReviewSnapshot(root, [skill])).rejects.toThrow('symlink');
});
it.each([
  '.agents',
  '.agents/skills',
  '.agents/skills/example',
  '.agents/skills/example/script.ts',
  '.agents/config.toml',
  'review-skill-evidence/file.txt',
])('rejects broad or privileged selection %s', async (path) => {
  const root = await source();
  await expect(prepareReviewSnapshot(root, [path])).rejects.toThrow('forbidden');
});
it.each([Buffer.from([0xc3, 0x28]), Buffer.from('text\0data'), Buffer.alloc(2_000_001, 97)])(
  'rejects invalid skill text before inspecting authentication',
  async (content) => {
    const root = await source(content);
    await expect(
      prepareSupervisedReview({
        sourceRoot: root,
        evidencePaths: [skill],
        image: 'sha256:' + 'a'.repeat(64),
        modelAuthFile: '/deliberately-missing-auth',
        egressNetwork: 'review-only',
        question: 'review',
      }),
    ).rejects.toThrow(/encoded data|NUL|input limit/u);
  },
);
it('rejects an uncommitted skill and a committed symlink', async () => {
  const root = await source();
  const other = '.agents/skills/other/SKILL.md';
  await mkdir(dirname(join(root, other)), { recursive: true });
  await writeFile(join(root, other), 'new');
  await expect(prepareReviewSnapshot(root, [other])).rejects.toThrow('committed regular');
  await rm(join(root, skill));
  await symlink('../../../plan.md', join(root, skill));
  git(root, 'add', skill);
  git(
    root,
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.invalid',
    'commit',
    '-qm',
    'symlink',
  );
  expect(() => captureCommittedReviewSkills(root, [skill])).toThrow('committed regular');
});

it('binds a new committed version and rejects duplicate selections', async () => {
  const root = await source();
  const first = await prepareReviewSnapshot(root, [skill]);
  cleanup.push(dirname(first.root));
  await writeFile(join(root, skill), 'new committed text');
  git(root, 'add', skill);
  git(
    root,
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.invalid',
    'commit',
    '-qm',
    'new version',
  );
  const second = await prepareReviewSnapshot(root, [skill]);
  cleanup.push(dirname(second.root));
  expect(second.materialDigest).not.toBe(first.materialDigest);
  expect(second.manifest[0]!.sourceRevision).not.toBe(first.manifest[0]!.sourceRevision);
  await expect(prepareReviewSnapshot(root, [skill, skill])).rejects.toThrow('exact SKILL.md');
});
it.skipIf(!process.env.WORKFLOW_REVIEW_IMAGE)(
  'real container reads inert evidence but cannot edit source or load installed skills',
  async () => {
    const root = await source();
    const auth = join(root, 'auth.json');
    await writeFile(auth, '{}');
    const prepared = await prepareSupervisedReview({
      sourceRoot: root,
      evidencePaths: [skill],
      image: process.env.WORKFLOW_REVIEW_IMAGE!,
      modelAuthFile: auth,
      egressNetwork: 'probe-only',
      question: 'offline probe',
    });
    cleanup.push(dirname(prepared.snapshot.root));
    const config = await readFile(join(prepared.snapshot.codexHome, 'config.toml'), 'utf8');
    expect(config).toContain('shell_tool = false');
    expect(config).toContain('multi_agent = false');
    expect(config).toContain('[mcp_servers]');
    expect(config).not.toMatch(/\[mcp_servers\./u);
    const prompt = JSON.parse(
      await readFile(join(dirname(prepared.snapshot.root), 'review-prompt.txt'), 'utf8'),
    );
    expect(prompt.manifest[0].sourceRevision).toBe(git(root, 'rev-parse', 'HEAD'));
    expect(prompt.evidence[0]).toEqual({ path: skill, content: 'committed skill text' });
    const args = prepared.launch.args.slice(0, -3);
    args[args.indexOf('--network') + 1] = 'none';
    const staged = '/workspace/' + prepared.snapshot.manifest[0]!.stagedPath!;
    args.push(
      'node',
      '-e',
      `const fs=require('fs'); const p=process.argv[1]; if(fs.readFileSync(p,'utf8')!=='committed skill text')process.exit(1); for(const target of [p,'/workspace/new.txt','/codex-home/config.toml']) { let denied=false; try {fs.writeFileSync(target,'changed')}catch(e){denied=['EROFS','EACCES','EPERM'].includes(e.code)} if(!denied)process.exit(2); } if(fs.existsSync('/workspace/.agents')||fs.existsSync('/codex-home/skills'))process.exit(3); fs.writeFileSync('/tmp/review-probe','allowed'); console.log('read=pass source-write=denied config-write=denied skills=absent temporary-write=pass');`,
      staged,
    );
    const output = execFileSync(prepared.launch.dockerBinary, args, {
      env: {},
      timeout: 20000,
    }).toString();
    expect(output).toContain('source-write=denied');
  },
  30000,
);

it('missing promised blobs cannot execute a repository-configured transport', async () => {
  const root = await source();
  const oid = git(root, 'rev-parse', `HEAD:${skill}`);
  const sentinel = join(root, 'transport-executed');
  const transport = join(root, 'transport.sh');
  await writeFile(transport, '#!/bin/sh\ntouch "' + sentinel + '"\nexit 1\n', { mode: 0o700 });
  git(root, 'config', 'extensions.partialClone', 'origin');
  git(root, 'config', 'remote.origin.url', 'ssh://example.invalid/repo');
  git(root, 'config', 'remote.origin.promisor', 'true');
  git(root, 'config', 'remote.origin.partialclonefilter', 'blob:none');
  git(root, 'config', 'protocol.ssh.allow', 'always');
  git(root, 'config', 'core.sshCommand', transport);
  await rm(join(root, '.git/objects', oid.slice(0, 2), oid.slice(2)));
  expect(() => captureCommittedReviewSkills(root, [skill])).toThrow();
  await expect(access(sentinel)).rejects.toThrow();
});
