import { expect, test } from '@playwright/test';
import type { ElectronApplication } from 'playwright';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { getDesktopPorts } from './support/runtime.js';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startGitDeliveryProvider } from '../../../e2e/support/git-delivery/model-provider.mjs';
import { createGhLedgerFixture } from '../../../e2e/support/git-delivery/gh-ledger.mjs';
import { createGitTransportFixture } from '../../../e2e/support/git-delivery/git-transport.mjs';
import {
  assertGitRecoveryReachable,
  createGitChatSession,
  gitChatKey,
  gitChatModel,
  gitChatReplies,
  openGitChat,
  runGitChatJourney,
  type GitChatApi,
  type GitChatScenario,
} from '../../../e2e/support/git-delivery/chat-journey.js';
import {
  contextTokenRepoRoot,
  createContextTokenFixture,
  exportContextTokenReport,
  launchContextTokenFixture,
  readContextTokenApi,
  removeContextTokenFixture,
  snapshotContextTokenDb,
  snapshotContextTokenDiagnosticStore,
  type ContextTokenFixture,
} from './support/contextTokenFixture.js';

const scenarios: GitChatScenario[] = ['success', 'denied', 'unknown'];
for (const scenario of scenarios) {
  test(`native hidden-rail chat Git delivery: ${scenario}`, async ({ playwright }, info) => {
    test.setTimeout(180_000);
    expect(playwright._electron).toBeDefined();
    let provider: Awaited<ReturnType<typeof startGitDeliveryProvider>> | undefined;
    let awake: ChildProcess | undefined;
    let fixture: ContextTokenFixture | undefined;
    let app: ElectronApplication | undefined;
    let transport: Awaited<ReturnType<typeof createGitTransportFixture>> | undefined;
    let gh: Awaited<ReturnType<typeof createGhLedgerFixture>> | undefined;
    let sessionId: string | undefined;
    const evidence: Record<string, unknown> = { scenario };
    const failures: unknown[] = [];
    let closed = false;
    let confirmedStops = 0;
    const stopCount = () => {
      const path = fixture ? join(fixture.runtimeDir, 'logs', 'desktop.stderr.log') : '';
      return path && existsSync(path)
        ? readFileSync(path, 'utf8').split('"phase":"stop-confirmed"').length - 1
        : 0;
    };
    const closeApp = async () => {
      if (!app) return;
      const before = stopCount();
      await app.close();
      expect(stopCount()).toBe(before + 1);
      confirmedStops += 1;
      expect(
        readFileSync(join(fixture!.runtimeDir, 'logs', 'desktop.stderr.log'), 'utf8'),
      ).not.toContain('"phase":"stop-failed"');
      app = undefined;
      closed = true;
    };
    try {
      provider = await startGitDeliveryProvider({
        model: gitChatModel,
        replies: gitChatReplies(scenario),
      });
      // Assertion belongs only to this test process; no machine power preferences are changed.
      awake = spawn('/usr/bin/caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' });
      awake.once('error', (error) => failures.push(error));
      fixture = await createContextTokenFixture(provider);
      const active = fixture;
      const ports = await getDesktopPorts();
      active.backendPort = ports.backendPort;
      active.rendererPort = ports.rendererPort;
      active.launchOptions.env.AGENT_PLATFORM_DESKTOP_BACKEND_PORT = String(ports.backendPort);
      active.launchOptions.env.AGENT_PLATFORM_DESKTOP_RENDERER_PORT = String(ports.rendererPort);
      const git = (...args: string[]) =>
        execFileSync('/usr/bin/git', ['-C', active.projectDir, ...args], {
          encoding: 'utf8',
          timeout: 10000,
        }).trim();
      const bare = join(active.root, 'remote.git');
      const remote = (...args: string[]) =>
        execFileSync('/usr/bin/git', ['--git-dir', bare, ...args], {
          encoding: 'utf8',
          timeout: 10000,
        }).trim();
      git('config', 'user.name', 'Git chat fixture');
      git('config', 'user.email', 'git-chat@example.invalid');
      git('branch', '-m', 'staging');
      execFileSync('/usr/bin/git', ['init', '--bare', bare], { stdio: 'ignore' });
      transport = await createGitTransportFixture({ bareRoot: bare });
      git('config', 'core.sshCommand', transport.sshCommand);
      git('config', 'ssh.variant', 'ssh');
      git('remote', 'add', 'origin', transport.remoteUrl);
      git('push', 'origin', 'HEAD:refs/heads/staging');
      const branch = `feature/chat-${scenario}`;
      git('switch', '-c', branch);
      gh = await createGhLedgerFixture({ currentBranch: branch });
      const ownedGh = gh;
      Object.assign(active.launchOptions.env, gh.env, { AGENT_PLATFORM_GH_BINARY: gh.executable });
      const reports = [
        join(active.root, 'waiting-report.json'),
        join(active.root, 'final-report.json'),
        join(active.root, 'before-restart-report.json'),
      ];
      app = await launchContextTokenFixture(
        active,
        scenario === 'unknown' ? [reports[0]!, reports[2]!] : reports,
      );
      let page = await app.firstWindow();
      const api: GitChatApi = <T>(path: string, init?: RequestInit) =>
        readContextTokenApi<T>(active, path, init);
      const identity = await createGitChatSession(
        api,
        active.projectDir,
        `git-chat-${scenario}-${randomUUID()}`,
      );
      sessionId = identity.session.id;
      await openGitChat(page, identity, `http://127.0.0.1:${active.rendererPort}`);
      const boundary = {
        git,
        remote,
        write: (path: string, value: string) => writeFileSync(join(active.projectDir, path), value),
        ledger: () => ownedGh.readLedger(),
        loseNextCreateResponse: () => ownedGh.setFailureModes({ loseCreateResponseOnce: true }),
      };
      const result = await runGitChatJourney({
        page,
        api,
        boundary,
        projectId: identity.projectId,
        sessionId,
        branch,
        scenario,
        ...(scenario === 'unknown'
          ? {
              restartBeforeRestore: async () => {
                const before = snapshotContextTokenDb(active, identity.session.id);
                const report = await exportContextTokenReport(page, reports[2]!, [
                  active.root,
                  gitChatKey,
                  'Chat Git delivery fixture content',
                ]);
                expect(
                  report.events.some(
                    (row) => row.event.phase === 'tool' && row.event.outcome === 'failed',
                  ),
                ).toBe(true);
                copyFileSync(reports[2]!, info.outputPath('before-restart-diagnostics.json'));
                const url = page.url();
                await closeApp();
                await expect(
                  fetch(`http://127.0.0.1:${active.backendPort}/v1/agents`, {
                    signal: AbortSignal.timeout(1000),
                  }),
                ).rejects.toThrow();
                app = await launchContextTokenFixture(active, [reports[1]!]);
                closed = false;
                page = await app.firstWindow();
                await page.goto(url);
                const after = snapshotContextTokenDb(active, identity.session.id);
                expect(after.approvals).toEqual(before.approvals);
                expect(after.audits).toEqual(before.audits);
                expect(provider!.requests).toHaveLength(4);
                evidence.backendRestart = {
                  sameDatabase: true,
                  sameSessionId: identity.session.id,
                  sameApprovalIds: before.approvals.map((row) => row.id),
                  auditCountUnchanged: before.audits.length,
                  confirmedStop: true,
                  apiUnavailableBetweenProcesses: true,
                  modelRequestsBeforeResume: provider!.requests.length,
                  beforeCoverage: report.coverage,
                };
                return page;
              },
            }
          : {}),
        waiting: async () => {
          const report = await exportContextTokenReport(page, reports[0]!, [
            active.root,
            gitChatKey,
            'Chat Git delivery fixture content',
          ]);
          expect(report.events.some((row) => row.event.outcome === 'waiting')).toBe(true);
          evidence.waitingCoverage = report.coverage;
          copyFileSync(reports[0]!, info.outputPath('waiting-diagnostics.json'));
        },
      });
      const report = await exportContextTokenReport(page, reports[1]!, [
        active.root,
        gitChatKey,
        'Chat Git delivery fixture content',
      ]);
      expect(
        report.events.some(
          (row) =>
            row.event.phase === 'tool' &&
            ['succeeded', 'failed', 'cancelled'].includes(row.event.outcome),
        ),
      ).toBe(true);
      copyFileSync(reports[1]!, info.outputPath('final-diagnostics.json'));
      evidence.finalCoverage = report.coverage;
      evidence.result = result;
      evidence.githubLedger = await ownedGh.readLedger();
      evidence.transportLedger = await transport.ledger();
      const db = snapshotContextTokenDb(active, sessionId);
      evidence.db = db;
      evidence.diagnosticStore = snapshotContextTokenDiagnosticStore(active, sessionId);
      expect(
        db.approvals.filter(
          (row) => row.status === (scenario === 'denied' ? 'rejected' : 'approved'),
        ),
      ).toHaveLength(scenario === 'denied' ? 1 : 4);
      expect(db.audits.some((row) => String(row.tool_name).startsWith('sys_git_'))).toBe(true);
      expect(provider.errors).toEqual([]);
      expect(provider.requests).toHaveLength(
        scenario === 'denied' ? 2 : scenario === 'unknown' ? 4 : 5,
      );
      if (scenario === 'denied') {
        expect(provider.requests[1]?.messages).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              role: 'tool',
              tool_call_id: 'chat-stage',
              content: expect.stringContaining('APPROVAL_REJECTED'),
            }),
          ]),
        );
        expect(db.audits.some((row) => String(row.result_json).includes('"rejected":true'))).toBe(
          true,
        );
      }
      if (scenario === 'success') {
        // Real persisted recovery-only rows represent approval-save-failure cancellation.
        const ids = JSON.parse(
          execFileSync(
            process.execPath,
            [
              '--input-type=module',
              '-e',
              `
          import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
          import {openDatabase,getGitDeliveryOperation,insertGitDeliveryOperation} from './packages/db/dist/index.js';
          const input=JSON.parse(readFileSync(0,'utf8'));const {db,sqlite}=openDatabase(input.path);
          try {const source=getGitDeliveryOperation(db,input.id);if(!source||source.receipt.sessionId!==input.sessionId)throw Error('Owned source missing');const ids=[];
          for(let index=0;index<8;index++){const id=randomUUID();const at=Date.now()+index;insertGitDeliveryOperation(db,{...source,toolCallId:randomUUID(),actionKey:randomUUID(),receipt:{...source.receipt,id,state:'cancelled',createdAtMs:at,updatedAtMs:at,expiresAtMs:at+900000}});ids.push(id);}console.log(JSON.stringify(ids));}finally{sqlite.close();}
        `,
            ],
            {
              cwd: contextTokenRepoRoot,
              input: JSON.stringify({
                path: active.sqlitePath,
                id: result.operations[0]!.id,
                sessionId,
              }),
              encoding: 'utf8',
            },
          ),
        ) as string[];
        await app.evaluate(({ BrowserWindow }) => {
          BrowserWindow.getAllWindows()[0]?.setSize(1100, 760);
        });
        await assertGitRecoveryReachable(page, ids);
        evidence.recoveryOnlyViewport = {
          records: ids.length,
          reachable: true,
          confirmedDeleted: ids.at(-1),
        };
      }
      await page.screenshot({ path: info.outputPath('terminal.png') });
    } catch (error) {
      failures.push(error);
    } finally {
      evidence.providerRequestCount = provider?.requests.length ?? 0;
      evidence.providerErrors = provider?.errors ?? [];
      if (fixture && sessionId) {
        try {
          evidence.finalDb = snapshotContextTokenDb(fixture, sessionId);
        } catch (error) {
          failures.push(error);
        }
      }
      if (app) {
        try {
          await closeApp();
        } catch (error) {
          failures.push(error);
        }
      }
      evidence.confirmedStops = confirmedStops;
      try {
        await provider?.close();
      } catch (error) {
        failures.push(error);
      }
      if (closed || !app) {
        try {
          await gh?.close();
        } catch (error) {
          failures.push(error);
        }
      }
      if (closed || !app) {
        try {
          await transport?.close();
        } catch (error) {
          failures.push(error);
        }
      }
      if (awake && awake.exitCode === null && awake.signalCode === null) {
        const child = awake;
        try {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error('Owned awake assertion did not close')),
              2000,
            );
            child.once('close', () => {
              clearTimeout(timer);
              resolve();
            });
            child.kill('SIGTERM');
          });
        } catch (error) {
          failures.push(error);
        }
      }
      const evidencePath = info.outputPath('git-chat-native-evidence.json');
      writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
      await info.attach('git-chat-native-evidence', {
        path: evidencePath,
        contentType: 'application/json',
      });
      if (fixture && closed && failures.length === 0) removeContextTokenFixture(fixture);
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        failures
          .map((error) => (error instanceof Error ? error.message : String(error)))
          .join('\n'),
      );
  });
}
