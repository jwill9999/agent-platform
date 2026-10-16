import { expect, type TestInfo } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { startStopProvider } from '../../../../e2e/support/project-chat-stop/provider.mjs';
import {
  runStopJourney,
  stopSnapshotSource,
  type StopScenario,
  type StopJourneyContext,
  type StopSnapshot,
} from '../../../../e2e/support/project-chat-stop/journey.js';
import { CONTEXT_TOKEN_MODEL } from './contextTokenProvider.js';
import {
  stopSensorNpmrc,
  stopSensorPackage,
  stopSensorScript,
} from '../../../../e2e/support/project-chat-stop/sensor-fixture.js';
import {
  createContextTokenFixture,
  createContextTokenAgent,
  launchContextTokenFixture,
  openContextTokenProject,
  readContextTokenApi,
  exportContextTokenReport,
  removeContextTokenFixture,
  contextTokenRepoRoot,
  type ContextTokenFixture,
} from './contextTokenFixture.js';

export async function nativeStopJourney(info: TestInfo, scenario: StopScenario) {
  const failures: unknown[] = [];
  const provider = await startStopProvider({ model: CONTEXT_TOKEN_MODEL });
  let fixture: ContextTokenFixture | undefined;
  let app: ElectronApplication | undefined;
  let page: Page | undefined;
  let ctx: StopJourneyContext | undefined;
  let traced = false;
  const settle = async (action: () => unknown) => {
    try {
      await action();
    } catch (error) {
      failures.push(error);
    }
  };
  try {
    fixture = await createContextTokenFixture(provider);
    const owned = fixture;
    const destinations = ['waiting', 'stopped', 'failure'].map((name) =>
      join(owned.root, `stop-${name}.json`),
    );
    app = await launchContextTokenFixture(owned, destinations);
    page = await app.firstWindow();
    const agent = await createContextTokenAgent(owned);
    const session = await openContextTokenProject(page, owned, agent);
    await page.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    traced = true;
    let exportIndex = 0;
    const effectPath = join(owned.projectDir, 'stop-effect.txt');
    const raw = (path: string, init: RequestInit = {}) =>
      fetch(`http://127.0.0.1:${owned.backendPort}/v1/${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', ...init.headers },
        signal: AbortSignal.timeout(10_000),
      });
    const snapshot = (): StopSnapshot =>
      JSON.parse(
        execFileSync(
          process.execPath,
          ['--input-type=module', '-e', stopSnapshotSource, session.id, owned.sqlitePath],
          {
            cwd: contextTokenRepoRoot,
            encoding: 'utf8',
            timeout: 10_000,
            maxBuffer: 2_000_000,
            env: { PATH: process.env.PATH, SQLITE_PATH: owned.sqlitePath },
          },
        ),
      ) as StopSnapshot;
    ctx = {
      page,
      provider,
      sessionId: session.id,
      projectId: session.projectId,
      agentId: agent.id,
      projectPath: owned.projectDir,
      effectPath,
      origin: `http://127.0.0.1:${owned.rendererPort}`,
      api: <T>(path: string, init?: RequestInit) => readContextTokenApi<T>(owned, path, init),
      raw,
      snapshot,
      prepareSensorFiles: () => {
        writeFileSync(join(owned.projectDir, 'package.json'), stopSensorPackage);
        writeFileSync(join(owned.projectDir, '.npmrc'), stopSensorNpmrc);
        writeFileSync(join(owned.projectDir, 'stop-sensor.cjs'), stopSensorScript);
      },
      readSensorMarker: () => ({
        started: existsSync(join(owned.projectDir, 'sensor-started.jsonl'))
          ? readFileSync(join(owned.projectDir, 'sensor-started.jsonl'), 'utf8')
              .trim()
              .split('\n')
              .filter(Boolean).length
          : 0,
        finished: existsSync(join(owned.projectDir, 'sensor-finished.jsonl'))
          ? readFileSync(join(owned.projectDir, 'sensor-finished.jsonl'), 'utf8')
              .trim()
              .split('\n')
              .filter(Boolean).length
          : 0,
      }),
      releaseSensor: () => writeFileSync(join(owned.projectDir, 'sensor-release'), 'release'),
      writeEffect: (content) => writeFileSync(effectPath, content),
      readEffect: () => readFileSync(effectPath, 'utf8'),
      evidence: {
        topology:
          'Real standalone Electron renderer/BFF/managed API/SQLite/approval/file effects; deterministic loopback model and native Save As destination only. No paid/live provider or VM claim.',
        sourceHashes: Object.fromEntries(
          [
            'apps/web/hooks/use-harness-run-control.ts',
            'apps/web/hooks/use-harness-chat.ts',
            'apps/api/src/application/runControl/service.ts',
            'apps/api/src/infrastructure/http/v1/chatRouter.ts',
            'e2e/support/project-chat-stop/journey.ts',
            'e2e/support/project-chat-stop/provider.mjs',
          ].map((file) => [
            file,
            createHash('sha256')
              .update(readFileSync(join(contextTokenRepoRoot, file)))
              .digest('hex'),
          ]),
        ),
      },
      exportReport: async (name) => {
        const destination = destinations[exportIndex++];
        if (!destination || !page) throw new Error('Stop fixture diagnostic destination exhausted');
        const report = await exportContextTokenReport(page, destination, [
          'STOP_PRIVATE_PROMPT_CANARY',
          'STOP_APPROVED_EFFECT_CANARY',
          owned.root,
        ]);
        expect('sessionId' in report.scope && report.scope.sessionId).toBe(session.id);
        copyFileSync(destination, info.outputPath(`stop-${name}.json`));
        return report;
      },
    };
    await runStopJourney(ctx, scenario);
    expect(provider.errors).toEqual([]);
  } catch (error) {
    failures.push(error);
  } finally {
    if (failures.length && ctx && page && !page.isClosed()) {
      await settle(async () => {
        await page!.screenshot({ path: info.outputPath('stop-failure-before-export.png') });
        await page!.keyboard.press('Escape');
        const report = await ctx!.exportReport('failure-capture');
        ctx!.evidence.failureDiagnostic = report;
      });
    }
    await settle(async () => {
      if (ctx) {
        ctx.evidence.final = ctx.snapshot();
        ctx.evidence.providerLedger = provider.ledger;
        ctx.evidence.providerRequests = provider.requests.length;
        ctx.evidence.providerErrors = provider.errors;
      }
      writeFileSync(
        info.outputPath('stop-evidence.json'),
        JSON.stringify({ ...ctx?.evidence, failures: failures.map(String) }, null, 2),
      );
      await info.attach('stop-evidence', {
        path: info.outputPath('stop-evidence.json'),
        contentType: 'application/json',
      });
    });
    await settle(async () => {
      if (page && !page.isClosed()) await page.screenshot({ path: info.outputPath('stop-ui.png') });
    });
    await settle(async () => {
      if (page && traced)
        await page.context().tracing.stop({ path: info.outputPath('stop-trace.zip') });
    });
    await settle(async () => {
      ctx?.releaseSensor();
      if (ctx && ctx.readSensorMarker().started > ctx.readSensorMarker().finished)
        await expect
          .poll(() => ctx!.readSensorMarker().finished, { timeout: 5000 })
          .toBe(ctx.readSensorMarker().started);
    });
    await settle(() => app?.close());
    await settle(async () => provider.close());
    await settle(() => {
      if (!fixture) return;
      for (const name of ['agent.sqlite', 'diagnostics.sqlite']) {
        const source = join(fixture.runtimeDir, 'data', name);
        if (existsSync(source)) copyFileSync(source, info.outputPath(name));
      }
      removeContextTokenFixture(fixture);
    });
  }
  if (failures.length)
    throw new AggregateError(failures, 'Connected Electron Stop journey failed', {
      cause: failures[0],
    });
}
