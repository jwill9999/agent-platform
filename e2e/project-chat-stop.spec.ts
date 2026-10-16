import { expect } from '@playwright/test';
import { test } from './support/mcp-test.js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dockerStopProvider } from './support/project-chat-stop/docker-provider.js';
import {
  runStopJourney,
  stopScenarios,
  stopSnapshotSource,
  type StopJourneyContext,
  type StopSnapshot,
} from './support/project-chat-stop/journey.js';
import {
  stopSensorNpmrc,
  stopSensorPackage,
  stopSensorScript,
} from './support/project-chat-stop/sensor-fixture.js';

import { openGitChat } from './support/git-delivery/chat-journey.js';

const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';
test.use({ trace: 'on' });
for (const scenario of stopScenarios) {
  test(`Stop shared harness Docker browser ${scenario}: durable authority and real effect boundaries`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    const name = `stop-browser-${randomUUID()}`;
    const owned: Array<[string, string]> = [];
    const failures: unknown[] = [];
    let provider: Awaited<ReturnType<typeof dockerStopProvider>> | undefined;
    let ctx: StopJourneyContext | undefined;
    const raw = (path: string, init: RequestInit = {}) =>
      fetch(`${apiURL}/v1/${path}`, {
        ...init,
        // Direct fixture reads never reuse an idle Docker-forwarded socket.
        // This changes no browser transport and retries no mutation.
        headers: { 'content-type': 'application/json', connection: 'close', ...init.headers },
        signal: AbortSignal.timeout(10_000),
      });
    const api = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
      const response = await raw(path, init);
      if (!response.ok)
        throw new Error(
          `Stop fixture ${init.method ?? 'GET'} ${path.split('/')[0]} failed HTTP${response.status}`,
        );
      const body = await response.json();
      if (init.method === 'POST') {
        if (['model-configs', 'agents', 'sessions'].includes(path))
          owned.unshift([path, body.data.id]);
        if (path === 'projects/desktop/register') owned.unshift(['projects', body.data.project.id]);
      }
      return body.data as T;
    };
    const settle = async (action: () => Promise<unknown> | unknown) => {
      try {
        await action();
      } catch (error) {
        failures.push(error);
      }
    };
    const directory = `/tmp/${name}`;
    try {
      provider = await dockerStopProvider(apiURL, name);
      const boundary = provider;
      boundary.exec(['mkdir', '-p', directory]);
      boundary.exec(['git', 'init', '-q', directory]);
      const model = await api<{ id: string }>('model-configs', {
        method: 'POST',
        body: JSON.stringify({
          name,
          provider: 'ollama',
          model: name,
          apiKey: 'stop-fixture-local-only-key',
        }),
      });
      const agent = await api<{ id: string; name: string }>('agents', {
        method: 'POST',
        body: JSON.stringify({
          name,
          systemPrompt: 'Follow only the disposable Stop fixture request.',
          allowedSkillIds: [],
          allowedToolIds: [],
          allowedMcpServerIds: [],
          pluginAllowlist: [],
          modelConfigId: model.id,
          executionLimits: { maxSteps: 6, maxParallelTasks: 1, timeoutMs: 30000 },
        }),
      });
      const project = await api<{ project: { id: string } }>('projects/desktop/register', {
        method: 'POST',
        headers: { 'x-agent-platform-desktop-bridge': '1' },
        body: JSON.stringify({ name, path: directory }),
      });
      const session = await api<{ id: string }>('sessions', {
        method: 'POST',
        body: JSON.stringify({ agentId: agent.id, mode: 'project', projectId: project.project.id }),
      });
      await openGitChat(page, { model, agent, session, projectId: project.project.id });
      const effectPath = `${directory}/stop-effect.txt`;
      ctx = {
        page,
        provider: boundary,
        sessionId: session.id,
        projectId: project.project.id,
        agentId: agent.id,
        projectPath: directory,
        effectPath,
        origin: new URL(page.url()).origin,
        api,
        raw,
        snapshot: () =>
          JSON.parse(
            boundary.exec(['node', '--input-type=module', '-e', stopSnapshotSource, session.id]),
          ) as StopSnapshot,
        prepareSensorFiles: () => {
          boundary.exec([
            'node',
            '--input-type=module',
            '-e',
            "import{writeFileSync}from'node:fs';import{join}from'node:path';writeFileSync(join(process.argv[1],'package.json'),process.argv[2]);writeFileSync(join(process.argv[1],'stop-sensor.cjs'),process.argv[3]);writeFileSync(join(process.argv[1],'.npmrc'),process.argv[4]);",
            directory,
            stopSensorPackage,
            stopSensorScript,
            stopSensorNpmrc,
          ]);
          const actualPnpm = boundary
            .exec([
              'node',
              '--input-type=module',
              '-e',
              "import{execFileSync}from'node:child_process';process.stdout.write(execFileSync('/usr/local/bin/pnpm',['--version'],{cwd:process.argv[1]}));",
              directory,
            ])
            .trim();
          expect(actualPnpm).toBe('9.15.4');
          ctx!.evidence.sensorEnvironment = { actualPnpm, packageManager: 'pnpm@9.15.4' };
        },
        readSensorMarker: () =>
          JSON.parse(
            boundary.exec([
              'node',
              '--input-type=module',
              '-e',
              "import{existsSync,readFileSync}from'node:fs';import{join}from'node:path';const count=name=>existsSync(join(process.argv[1],name))?readFileSync(join(process.argv[1],name),'utf8').trim().split('\\n').filter(Boolean).length:0;console.log(JSON.stringify({started:count('sensor-started.jsonl'),finished:count('sensor-finished.jsonl')}));",
              directory,
            ]),
          ),
        releaseSensor: () => {
          boundary.exec([
            'node',
            '--input-type=module',
            '-e',
            "import{writeFileSync}from'node:fs';import{join}from'node:path';writeFileSync(join(process.argv[1],'sensor-release'),'release');",
            directory,
          ]);
        },
        writeEffect: (content) => {
          boundary.exec([
            'node',
            '--input-type=module',
            '-e',
            "import{writeFileSync}from'node:fs';writeFileSync(process.argv[1],process.argv[2]);",
            effectPath,
            content,
          ]);
        },
        readEffect: () =>
          boundary.exec([
            'node',
            '--input-type=module',
            '-e',
            "import{readFileSync}from'node:fs';process.stdout.write(readFileSync(process.argv[1],'utf8'));",
            effectPath,
          ]),
        evidence: {
          topology:
            'Real Docker Chromium renderer/BFF/API/SQLite/approval/files; deterministic in-container loopback model only. Browser has no private diagnostic capability; exports qualified separately in Electron. No paid provider or native VM claim.',
        },
        exportReport: async (name) => {
          const result = await page.evaluate(async (sessionId) => {
            const response = await fetch('/api/diagnostics/report', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ scope: { sessionId } }),
            });
            return { status: response.status, body: await response.json() };
          }, session.id);
          expect(result.status).toBe(403);
          expect(result.body.error.code).toBe('DIAGNOSTICS_DENIED');
          ctx!.evidence[`diagnostic-${name}`] = result;
          return undefined;
        },
      };
      await runStopJourney(ctx, scenario);
      expect(provider.errors).toEqual([]);
    } catch (error) {
      failures.push(error);
    } finally {
      await settle(async () => {
        if (ctx) ctx.evidence.final = ctx.snapshot();
        const evidence = {
          ...ctx?.evidence,
          providerLedger: provider?.ledger,
          providerRequests: provider?.requests.length,
          providerErrors: provider?.errors,
          failures: failures.map((failure) =>
            failure instanceof Error
              ? { message: failure.message, stack: failure.stack, cause: String(failure.cause) }
              : String(failure),
          ),
        };
        const path = info.outputPath('stop-browser-evidence.json');
        writeFileSync(path, JSON.stringify(evidence, null, 2));
        await info.attach('stop-browser-evidence', { path, contentType: 'application/json' });
      });
      await settle(async () => {
        ctx?.releaseSensor();
        if (ctx && ctx.readSensorMarker().started > ctx.readSensorMarker().finished)
          await expect
            .poll(() => ctx!.readSensorMarker().finished, { timeout: 5000 })
            .toBe(ctx.readSensorMarker().started);
      });
      await settle(async () => provider?.close());
      for (const id of (ctx?.evidence.uiCreatedSessions ?? []) as string[])
        owned.unshift(['sessions', id]);
      for (const [resource, id] of owned)
        await settle(async () => {
          const result = await raw(`${resource}/${id}`, { method: 'DELETE' });
          expect(result.ok, `Delete owned ${resource}`).toBe(true);
        });
      await settle(() => provider?.exec(['rm', '-rf', directory]));
    }
    if (failures.length)
      throw new AggregateError(failures, 'Connected Docker browser Stop journey failed', {
        cause: failures[0],
      });
  });
}
