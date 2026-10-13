import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDatabase, createSession, openDatabase, replaceAgent } from '@agent-platform/db';
import { createProjectsRouter } from '../src/infrastructure/http/v1/projectsRouter.js';
import { createSessionsRouter } from '../src/infrastructure/http/v1/sessionsRouter.js';
import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';
import * as githubReadProcess from '../src/infrastructure/projects/githubReadProcess.js';

// Static executable: fixture data is read from JSON, never interpolated as code.
const GH_FIXTURE = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(root, 'control.json'), 'utf8'));
const args = process.argv.slice(2);
fs.appendFileSync(path.join(root, 'calls.jsonl'), JSON.stringify(args) + '\\n');
if (config.holdStage === args[0]) {
 fs.writeFileSync(path.join(root, 'stage-ready'), args[0]);
 setInterval(() => {}, 100);
} else {
const created = path.join(root, 'created');
const enrichment = fs.existsSync(created);
if (args[0] === '--version') { if (config.versionFail) process.exit(1); console.log('gh fixture'); process.exit(0); }
if (args[0] === 'auth') { if (config.authFail || (enrichment && config.enrichment === 'auth')) process.exit(1); process.exit(0); }
if (args[0] === 'pr' && args[1] === 'create') {
 fs.appendFileSync(created, 'created\\n');
 console.log(JSON.stringify({number:42,title:'Created',state:'OPEN',url:'https://github.com/fixture/repo/pull/42',headRefName:config.branch,baseRefName:'main'}));
 process.exit(0);
}
const query = args[0] === 'api' ? 'api' : args[1];
const ready = path.join(root, 'ready-' + process.pid);
fs.writeFileSync(ready, query);
let timer;
function finish() {
 if ((config.noPr && query === 'view') || config.queryFail || (enrichment && config.enrichment === 'query')) process.exit(1);
 if (config.malformed || (enrichment && config.enrichment === 'parse')) { console.log('{bad'); process.exit(0); }
 if (query === 'list') console.log(JSON.stringify([{number:42,title:'Fixture',state:'OPEN',url:'https://github.com/fixture/repo/pull/42',headRefName:config.branch,baseRefName:'main'}]));
 else if (query === 'api') console.log(JSON.stringify([{id:1,name:'CI',status:'completed',conclusion:'success'}]));
 else console.log(JSON.stringify({number:42,url:'https://github.com/fixture/repo/pull/42',statusCheckRollup:[{databaseId:1,name:'CI',status:'COMPLETED',conclusion:'SUCCESS'}]}));
 process.exit(0);
}
if (config.hold || (enrichment && config.enrichment === 'timeout')) {
 timer = setInterval(() => { if (fs.existsSync(path.join(root, 'release'))) { clearInterval(timer); finish(); } }, 10);
} else finish();
}
`;

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 4000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Fixture readiness deadline exceeded');
    await delay(10);
  }
}

describe('bounded GitHub read API integration', () => {
  let root: string;
  let repo: string;
  let fixture: string;
  let opened: ReturnType<typeof openDatabase>;
  let server: Server;
  let base: string;
  let projectId: string;
  let branch: string;
  let sessionId: string;
  let config: Record<string, unknown>;
  const git = (...args: string[]) =>
    execFileSync('/usr/bin/git', ['-C', repo, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  const setConfig = (values: Record<string, unknown>) => {
    Object.assign(config, values);
    writeFileSync(join(fixture, 'control.json'), JSON.stringify(config));
  };
  const calls = (): string[][] =>
    existsSync(join(fixture, 'calls.jsonl'))
      ? readFileSync(join(fixture, 'calls.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
      : [];
  const queries = () =>
    calls().filter(
      (args) => (args[0] === 'pr' && ['view', 'list'].includes(args[1] ?? '')) || args[0] === 'api',
    );
  const release = () => writeFileSync(join(fixture, 'release'), 'release');
  const endpoint = (suffix: string) => `/v1/projects/${projectId}/${suffix}`;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'github-read-api-'));
    repo = join(root, 'repo space;literal');
    fixture = join(root, 'fixture');
    mkdirSync(fixture);
    execFileSync('/usr/bin/git', ['init', '-b', 'main', repo], { stdio: 'ignore' });
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    writeFileSync(join(repo, 'README.md'), 'fixture\n');
    git('add', 'README.md');
    git('commit', '-m', 'fixture');
    branch = 'task/literal;dollar$(safe)';
    git('checkout', '-b', branch);
    git('remote', 'add', 'origin', 'https://github.com/fixture/repo.git');
    config = { branch };
    setConfig({});
    const executable = join(fixture, 'gh.cjs');
    writeFileSync(executable, GH_FIXTURE);
    chmodSync(executable, 0o700);
    process.env['AGENT_PLATFORM_GH_BINARY'] = executable;
    opened = openDatabase(join(root, 'test.sqlite'));
    replaceAgent(opened.db, {
      id: 'agent-1',
      slug: 'agent-1',
      name: 'Fixture',
      systemPrompt: 'sys',
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
      executionLimits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 30000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    sessionId = createSession(opened.db, { agentId: 'agent-1', mode: 'chat' }).id;
    const app = express();
    app.use(express.json());
    app.get('/health', (_req, res) => res.json({ ok: true }));
    app.use('/v1/projects', createProjectsRouter(opened.db));
    app.use('/v1/sessions', createSessionsRouter(opened.db));
    app.use(errorMiddleware);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing server address');
    base = `http://127.0.0.1:${address.port}`;
    const registered = await request(server)
      .post('/v1/projects/open')
      .send({ path: realpathSync(repo), name: 'Fixture' })
      .expect(201);
    projectId = registered.body.data.id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    release();
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await delay(50);
    delete process.env['AGENT_PLATFORM_GH_BINARY'];
    closeDatabase(opened.sqlite);
    rmSync(root, { recursive: true, force: true });
  });

  it('completes health and persisted session reads before two held GitHub queries release', async () => {
    setConfig({ hold: true });
    const checks = fetch(base + endpoint('git/checks')).then((response) => response.json());
    const list = fetch(base + endpoint('github/pull-requests')).then((response) => response.json());
    await until(() => queries().length === 2);
    const started = performance.now();
    await request(server).get('/health').expect(200);
    await request(server).get(`/v1/sessions/${sessionId}`).expect(200);
    const probesMs = performance.now() - started;
    expect(probesMs).toBeLessThan(1000);
    console.info(
      '[github read API responsiveness]',
      JSON.stringify({
        concurrentHeldQueries: 2,
        healthAndSessionMs: probesMs,
        completedBeforeRelease: !existsSync(join(fixture, 'release')),
      }),
    );
    expect(existsSync(join(fixture, 'release'))).toBe(false);
    release();
    expect((await checks).data).toMatchObject({
      available: true,
      currentBranch: branch,
      scope: 'pull_request',
    });
    expect((await list).data).toMatchObject({ available: true, currentBranch: branch });
    const view = calls().find((args) => args[1] === 'view');
    expect(view).toEqual([
      'pr',
      'view',
      '--repo',
      'fixture/repo',
      '--json',
      'number,url,statusCheckRollup',
      '--',
      branch,
    ]);
    expect(calls().find((args) => args[1] === 'list')).toEqual(
      expect.arrayContaining(['--limit', '30']),
    );
  });

  it.each(['branch', 'head', 'origin', 'remove'] as const)(
    'returns unavailable after repository %s changes during a read',
    async (change) => {
      setConfig({ hold: true });
      const pending = fetch(base + endpoint('git/checks')).then((response) => response.json());
      await until(() => queries().length === 1);
      if (change === 'branch') git('checkout', '-b', 'different');
      if (change === 'head') git('commit', '--allow-empty', '-m', 'next');
      if (change === 'origin')
        git('remote', 'set-url', 'origin', 'https://github.com/fixture/other.git');
      if (change === 'remove') renameSync(repo, repo + '-moved');
      release();
      expect((await pending).data).toMatchObject({
        available: false,
        checks: [],
        reason: expect.stringContaining('changed'),
      });
    },
  );

  it('does not mark a PR list as belonging to a branch changed during the read', async () => {
    setConfig({ hold: true });
    const pending = fetch(base + endpoint('github/pull-requests')).then((response) =>
      response.json(),
    );
    await until(() => queries().length === 1);
    git('checkout', '-b', 'changed-list');
    release();
    expect((await pending).data).toMatchObject({ available: false, pullRequests: [] });
  });

  it('rejects a missing HEAD without starting GitHub queries', async () => {
    git('checkout', '--orphan', 'unborn');
    for (const suffix of ['git/checks', 'github/pull-requests']) {
      const response = await request(server).get(endpoint(suffix)).expect(200);
      expect(response.body.data.available).toBe(false);
    }
    expect(calls()).toEqual([]);
  });

  it('pins no-PR and detached-HEAD fallback to the full captured commit', async () => {
    setConfig({ noPr: true });
    const head = git('rev-parse', 'HEAD');
    const response = await request(server).get(endpoint('git/checks')).expect(200);
    expect(response.body.data).toMatchObject({ available: true, scope: 'head_commit' });
    expect(calls()).toContainEqual([
      'api',
      `repos/fixture/repo/commits/${head}/check-runs`,
      '--jq',
      '.check_runs',
    ]);
    git('checkout', '--detach', head);
    const before = calls().length;
    await request(server).get(endpoint('git/checks')).expect(200);
    expect(
      calls()
        .slice(before)
        .some((args) => args[1] === 'view'),
    ).toBe(false);
  });

  it.each(['git/checks', 'github/pull-requests'])(
    'preserves malformed-success 502 on %s',
    async (suffix) => {
      setConfig({ malformed: true });
      await request(server).get(endpoint(suffix)).expect(502);
    },
  );

  it.each(['missing', 'version', 'auth', 'query'] as const)(
    'reports safe unavailable for %s failures',
    async (failure) => {
      if (failure === 'missing') process.env['AGENT_PLATFORM_GH_BINARY'] = join(root, 'missing');
      else setConfig({ [failure + 'Fail']: true });
      for (const suffix of ['git/checks', 'github/pull-requests']) {
        const result = await request(server).get(endpoint(suffix)).expect(200);
        expect(result.body.data.available).toBe(false);
        expect(JSON.stringify(result.body)).not.toContain(fixture);
      }
    },
  );

  it('rejects a fifth operation without spawning, cancels one consumer and recovers capacity', async () => {
    setConfig({ hold: true });
    const controllers = Array.from({ length: 4 }, () => new AbortController());
    const pending = controllers.map((controller) =>
      fetch(base + endpoint('git/checks'), { signal: controller.signal }).then(
        (r) => r.json(),
        () => undefined,
      ),
    );
    await until(() => queries().length === 4);
    const before = calls().length;
    const busy = await request(server).get(endpoint('github/pull-requests')).expect(200);
    expect(busy.body.data).toMatchObject({
      available: false,
      reason: expect.stringContaining('busy'),
    });
    expect(calls()).toHaveLength(before);
    controllers[0]!.abort();
    await pending[0];
    await delay(350);
    const recovered = fetch(base + endpoint('github/pull-requests')).then((r) => r.json());
    await until(() => queries().length === 5);
    release();
    expect((await recovered).data.available).toBe(true);
    await Promise.all(pending);
  });

  it('keeps two Projects and their GitHub outputs separate under concurrent reads', async () => {
    const otherRepo = join(root, 'second-project');
    execFileSync('/usr/bin/git', ['clone', '--local', repo, otherRepo], { stdio: 'ignore' });
    execFileSync('/usr/bin/git', [
      '-C',
      otherRepo,
      'remote',
      'set-url',
      'origin',
      'https://github.com/fixture/second.git',
    ]);
    const other = await request(server)
      .post('/v1/projects/open')
      .send({ path: otherRepo, name: 'Other' })
      .expect(201);
    setConfig({ hold: true });
    const first = fetch(base + endpoint('git/checks')).then((r) => r.json());
    const second = fetch(base + `/v1/projects/${other.body.data.id}/git/checks`).then((r) =>
      r.json(),
    );
    await until(() => queries().length === 2);
    release();
    expect((await first).data.remoteUrl).toBe('https://github.com/fixture/repo.git');
    expect((await second).data.remoteUrl).toBe('https://github.com/fixture/second.git');
    expect(
      queries()
        .map((args) => args[args.indexOf('--repo') + 1])
        .sort(),
    ).toEqual(['fixture/repo', 'fixture/second']);
  });

  it('does not replay a created PR when its consumer disconnects during enrichment', async () => {
    git('update-ref', `refs/remotes/origin/${branch}`, git('rev-parse', 'HEAD'));
    git('config', `branch.${branch}.remote`, 'origin');
    git('config', `branch.${branch}.merge`, `refs/heads/${branch}`);
    setConfig({ hold: true });
    const controller = new AbortController();
    const pending = fetch(base + endpoint('github/pull-requests'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Created' }),
      signal: controller.signal,
    }).then(
      () => 'unexpected response',
      () => 'aborted',
    );
    await until(() => queries().length === 1);
    controller.abort();
    expect(await pending).toBe('aborted');
    await delay(350);
    release();
    await request(server).get(endpoint('git/checks')).expect(200);
    expect(readFileSync(join(fixture, 'created'), 'utf8')).toBe('created\n');
  });

  it('retains created identity when the repository changes during enrichment', async () => {
    git('update-ref', `refs/remotes/origin/${branch}`, git('rev-parse', 'HEAD'));
    git('config', `branch.${branch}.remote`, 'origin');
    git('config', `branch.${branch}.merge`, `refs/heads/${branch}`);
    setConfig({ hold: true });
    const pending = fetch(base + endpoint('github/pull-requests'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Created' }),
    }).then((response) => response.json());
    await until(() => queries().length === 1);
    git('checkout', '-b', 'changed-after-create');
    release();
    const response = await pending;
    expect(response.data).toMatchObject({
      pullRequest: { number: 42, headRefName: branch },
      pullRequests: { available: false },
    });
    expect(response.data.checks).toBeUndefined();
    expect(readFileSync(join(fixture, 'created'), 'utf8')).toBe('created\n');
  });

  it.each(['--version', 'auth'])(
    'uses the shared deadline when %s stalls and never starts a query or fallback',
    async (stage) => {
      setConfig({ holdStage: stage });
      const started = performance.now();
      const pending = fetch(base + endpoint('git/checks'));
      await until(() => existsSync(join(fixture, 'stage-ready')));
      const response = await pending;
      const elapsedMs = performance.now() - started;
      expect(response.status).toBe(200);
      expect((await response.json()).data).toMatchObject({
        available: false,
        reason: expect.stringContaining('time limit'),
      });
      expect(elapsedMs).toBeGreaterThanOrEqual(9500);
      expect(elapsedMs).toBeLessThan(10750);
      expect(calls()).toEqual(
        stage === '--version'
          ? [['--version']]
          : [['--version'], ['auth', 'status', '--hostname', 'github.com']],
      );
      console.info(
        '[github read stage deadline]',
        JSON.stringify({ stage, elapsedMs, laterQueries: queries().length }),
      );
      setConfig({ holdStage: undefined });
      await request(server)
        .get(endpoint('git/checks'))
        .expect(200)
        .expect((result) => expect(result.body.data.available).toBe(true));
    },
    15000,
  );

  it.each(['initial', 'final'] as const)(
    'keeps %s repository metadata within the same operation deadline',
    async (stage) => {
      // Git is deliberately pinned in production. Substitute only this selected
      // child with a real stalled executable, preserving the real operation,
      // timer, process cleanup and all other Git/gh commands without a new seam.
      const acquire = githubReadProcess.acquireGitHubRead;
      const attemptedCommands: string[][] = [];
      let rootReads = 0;
      setConfig({ holdStage: '--stall-metadata' });
      vi.spyOn(githubReadProcess, 'acquireGitHubRead').mockImplementation((signal) => {
        const operation = acquire(signal);
        if (!operation) return undefined;
        const run = operation.run.bind(operation);
        operation.run = (binary, args, cwd) => {
          attemptedCommands.push([...args]);
          if (binary === '/usr/bin/git' && args.includes('--show-toplevel')) {
            rootReads += 1;
            if (rootReads === (stage === 'initial' ? 1 : 2)) {
              return run(join(fixture, 'gh.cjs'), ['--stall-metadata'], cwd);
            }
          }
          return run(binary, args, cwd);
        };
        return operation;
      });
      const started = performance.now();
      const pending = fetch(base + endpoint('github/pull-requests'));
      await until(() => existsSync(join(fixture, 'stage-ready')));
      const response = await pending;
      const elapsedMs = performance.now() - started;
      expect(response.status).toBe(200);
      expect((await response.json()).data).toMatchObject({
        available: false,
        reason: expect.stringContaining('time limit'),
        pullRequests: [],
      });
      expect(elapsedMs).toBeGreaterThanOrEqual(9500);
      expect(elapsedMs).toBeLessThan(10750);
      expect(attemptedCommands.at(-1)).toEqual([
        '-C',
        realpathSync(repo),
        'rev-parse',
        '--show-toplevel',
      ]);
      expect(attemptedCommands).toHaveLength(stage === 'initial' ? 1 : 8);
      expect(queries()).toHaveLength(stage === 'initial' ? 0 : 1);
      console.info(
        '[github read stage deadline]',
        JSON.stringify({
          stage: stage + '_metadata',
          elapsedMs,
          attemptedCommands: attemptedCommands.length,
        }),
      );
      vi.restoreAllMocks();
      setConfig({ holdStage: undefined });
      await request(server)
        .get(endpoint('github/pull-requests'))
        .expect(200)
        .expect((result) => expect(result.body.data.available).toBe(true));
    },
    15000,
  );

  it.each(['auth', 'query', 'parse', 'timeout'] as const)(
    'retains one successful PR creation after enrichment %s failure',
    async (enrichment) => {
      const head = git('rev-parse', 'HEAD');
      git('update-ref', `refs/remotes/origin/${branch}`, head);
      git('config', `branch.${branch}.remote`, 'origin');
      git('config', `branch.${branch}.merge`, `refs/heads/${branch}`);
      setConfig({ enrichment });
      const response = await request(server)
        .post(endpoint('github/pull-requests'))
        .send({ title: 'Created' })
        .expect(200);
      expect(response.body.data).toMatchObject({
        pullRequest: { number: 42 },
        pullRequests: { available: false },
      });
      expect(response.body.data.checks).toBeUndefined();
      expect(readFileSync(join(fixture, 'created'), 'utf8')).toBe('created\n');
      expect(calls().filter((args) => args[1] === 'create')).toHaveLength(1);
    },
    15000,
  );
});
