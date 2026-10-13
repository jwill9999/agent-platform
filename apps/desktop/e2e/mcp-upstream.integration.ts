import { expect, test } from '@playwright/test';
import type { Agent, McpServer } from '@agent-platform/contracts';
import type { ElectronApplication } from 'playwright';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  contextTokenRepoRoot,
  createContextTokenAgent,
  createContextTokenFixture,
  exportContextTokenReport,
  launchContextTokenFixture,
  openContextTokenProject,
  readContextTokenApi,
  recordContextTokenEvidence,
  removeContextTokenFixture,
  sendContextTokenMessage,
  snapshotContextTokenDb,
  type ContextTokenFixture,
} from './support/contextTokenFixture.js';
import {
  startContextTokenProvider,
  type ContextTokenProviderReply,
} from './support/contextTokenProvider.js';

const HTTP_REFERENCE_PROGRAM = `
import process from 'node:process';
import {pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
const {createApp}=await import(pathToFileURL(join(dirname(process.argv[1]),'transports/streamableHttp.js')).href);
const {app,shutdown}=createApp();
const server=app.listen(0,'127.0.0.1',()=>process.stdout.write('REFERENCE_READY:'+String(server.address().port)+'\\n'));
process.on('SIGTERM',async()=>{await shutdown();server.closeAllConnections();server.close(()=>process.exit(0));});
`;

function referencePin() {
  const supplied = process.env.MCP_EVERYTHING_ENTRYPOINT;
  if (!supplied)
    throw new Error(
      'Set MCP_EVERYTHING_ENTRYPOINT to the preinstalled, reviewed Everything 1.0.0 dist/index.js. This test never installs packages.',
    );
  const entrypoint = resolve(supplied);
  const metadata = JSON.parse(
    readFileSync(join(dirname(entrypoint), '../package.json'), 'utf8'),
  ) as { name: string; version: string };
  expect(metadata).toMatchObject({
    name: '@modelcontextprotocol/server-everything',
    version: '1.0.0',
  });
  return {
    entrypoint,
    name: metadata.name,
    version: metadata.version,
    entrypointSha256: createHash('sha256').update(readFileSync(entrypoint)).digest('hex'),
  };
}

async function startHttpReference(entrypoint: string) {
  const child = spawn(
    process.execPath,
    ['--input-type=module', '-e', HTTP_REFERENCE_PROGRAM, entrypoint],
    {
      cwd: dirname(entrypoint),
      env: { PATH: process.env.PATH },
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );
  let closed = false;
  const close = async () => {
    if (closed || child.exitCode !== null) return;
    closed = true;
    await new Promise<void>((done) => {
      const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
      child.once('exit', () => {
        clearTimeout(timer);
        done();
      });
      child.kill('SIGTERM');
    });
  };
  try {
    const port = await new Promise<number>((done, reject) => {
      let buffered = '';
      const timer = setTimeout(() => reject(new Error('Reference HTTP startup timed out')), 10_000);
      child.once('error', () => {
        clearTimeout(timer);
        reject(new Error('Reference HTTP process could not start'));
      });
      child.once('exit', () => {
        clearTimeout(timer);
        reject(new Error('Reference HTTP process exited before readiness'));
      });
      child.stdout.on('data', (chunk: Buffer) => {
        buffered = (buffered + chunk.toString()).slice(-8192);
        const match = /REFERENCE_READY:(\d+)/.exec(buffered);
        if (match) {
          clearTimeout(timer);
          done(Number(match[1]));
        }
      });
    });
    return { url: `http://127.0.0.1:${port}/mcp`, close };
  } catch (error) {
    await close();
    throw error;
  }
}

for (const transport of ['stdio', 'streamable-http'] as const) {
  test(`pinned upstream ${transport}: real desktop chat approves and receives echo`, async () => {
    const pin = referencePin();
    const replies: ContextTokenProviderReply[] = [];
    const provider = await startContextTokenProvider(replies);
    let fixture: ContextTokenFixture | undefined;
    let app: ElectronApplication | undefined;
    let remote: Awaited<ReturnType<typeof startHttpReference>> | undefined;
    let passed = false;
    const failures: unknown[] = [];
    const evidence: Record<string, unknown> = {
      reference: { name: pin.name, version: pin.version, entrypointSha256: pin.entrypointSha256 },
      transport,
      mcpSourceHashes: Object.fromEntries(
        [
          'packages/mcp-adapter/src/manager.ts',
          'packages/mcp-adapter/src/session.ts',
          'packages/mcp-adapter/src/transport.ts',
          'packages/mcp-adapter/dist/session.js',
          'packages/harness/src/nodes/toolDispatch.ts',
          'packages/harness/src/security/mcpApproval.ts',
          'apps/api/src/infrastructure/diagnostics/observations.ts',
          'apps/desktop/e2e/mcp-upstream.integration.ts',
        ].map((path) => [
          path,
          createHash('sha256')
            .update(readFileSync(join(contextTokenRepoRoot, path)))
            .digest('hex'),
        ]),
      ),
      scope:
        'Source-tree native desktop, real API/SQLite/MCP, deterministic external model HTTP endpoint. No distribution claim.',
      referenceScenarioLimits: [
        'This reference scenario configures 64000 synthetic input tokens to accommodate the 13-tool catalog; no live model capacity is claimed.',
        'Only the read-only echo tool is called. Listing other Everything tools is not behavioral or security qualification of those tools.',
        'The external reference package and dependency lock are verified separately; this manual test requires that preinstalled package and does not install it.',
      ],
    };
    try {
      if (transport === 'streamable-http') remote = await startHttpReference(pin.entrypoint);
      fixture = await createContextTokenFixture(provider);
      const reportPath = join(fixture.root, 'mcp-reference-report.json');
      app = await launchContextTokenFixture(fixture, [reportPath]);
      const page = await app.firstWindow();
      await app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
      const config =
        transport === 'stdio'
          ? {
              name: 'Pinned upstream reference',
              transport,
              command: process.execPath,
              args: [pin.entrypoint, 'stdio'],
            }
          : { name: 'Pinned upstream reference', transport, url: remote!.url };
      const server = await readContextTokenApi<McpServer>(fixture, 'mcp-servers', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      const tested = await readContextTokenApi<{
        status: string;
        discoveredCount: number;
        eligibleCount: number;
        tools: unknown[];
      }>(fixture, `mcp-servers/${server.id}/test`, { method: 'POST', body: '{}' });
      expect(tested.status).toBe('ok');
      expect(tested.discoveredCount).toBe(13);
      expect(tested.eligibleCount).toBe(13);
      evidence.testResult = tested;
      const initialAgent = await createContextTokenAgent(fixture);
      const agent = await readContextTokenApi<Agent>(fixture, `agents/${initialAgent.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...initialAgent,
          allowedMcpServerIds: [server.id],
          contextWindow: { ...initialAgent.contextWindow, maxInputTokens: 64000 },
        }),
      });
      const session = await openContextTokenProject(page, fixture, agent);
      const toolId = `${server.id}:echo`;
      const marker = `MCP_UPSTREAM_${transport.replace('-', '_')}_CANARY`;
      replies.push(
        {
          kind: 'tools',
          calls: [
            {
              id: 'upstream-echo-once',
              name: toolId.replaceAll(':', '__'),
              args: { message: marker },
            },
          ],
        },
        { kind: 'text', text: 'Upstream reference echo complete.' },
      );
      await sendContextTokenMessage(page, 'Call the trusted reference echo tool once.');
      const card = page.getByTestId('approval-card');
      await expect(card).toHaveCount(1);
      const waiting = snapshotContextTokenDb(fixture, session.id);
      expect(waiting.approvals).toHaveLength(1);
      expect(waiting.approvals[0]!.status).toBe('pending');
      expect(
        waiting.audits.filter((row) => row.tool_name === toolId && row.status === 'success'),
      ).toHaveLength(0);
      expect(provider.requests).toHaveLength(1);
      expect(
        provider.requests[0]!.tools!.some(
          (tool) => tool.function.name === toolId.replaceAll(':', '__'),
        ),
      ).toBe(true);
      await card.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(
        page.getByText('Upstream reference echo complete.', { exact: true }).last(),
      ).toBeVisible();
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
      expect(provider.errors).toEqual([]);
      expect(provider.requests).toHaveLength(2);
      const completed = snapshotContextTokenDb(fixture, session.id);
      expect(completed.approvals[0]).toMatchObject({
        status: 'approved',
        resumed_at_ms: expect.any(Number),
      });
      expect(
        completed.audits.filter((row) => row.tool_name === toolId && row.status === 'success'),
      ).toHaveLength(1);
      const received = provider.requests[1]!.messages.find(
        (message) => message.role === 'tool' && message.tool_call_id === 'upstream-echo-once',
      );
      expect(JSON.stringify(received)).toContain(`Echo: ${marker}`);
      const report = await exportContextTokenReport(page, reportPath, [
        fixture.root,
        pin.entrypoint,
        marker,
      ]);
      evidence.completedApproval = completed.approvals[0];
      evidence.completedAudits = completed.audits.filter((row) => row.tool_name === toolId);
      evidence.diagnosticReport = report;
      evidence.providerRequestCount = provider.requests.length;
      evidence.echoResultVerified = true;
      await test.info().attach('mcp-reference-diagnostic-report', {
        path: reportPath,
        contentType: 'application/json',
      });
      expect(report.scope).toEqual({ sessionId: session.id });
      expect(
        report.events.some(
          (row) =>
            row.event.phase === 'tool' &&
            row.event.toolId === 'mcp' &&
            row.event.outcome === 'succeeded',
        ),
      ).toBe(true);
      passed = true;
    } catch (error) {
      failures.push(error);
    } finally {
      const cleanupErrors: unknown[] = [];
      if (fixture) {
        const page = app ? await app.firstWindow().catch(() => undefined) : undefined;
        await recordContextTokenEvidence(
          test.info(),
          fixture,
          `mcp-reference-${transport}`,
          { ...evidence, assertionsPassed: passed },
          page,
        ).catch((error: unknown) => {
          cleanupErrors.push(error);
        });
        if (app) {
          await app
            .context()
            .tracing.stop({ path: test.info().outputPath('mcp-reference-trace.zip') })
            .catch((error: unknown) => {
              cleanupErrors.push(error);
            });
          await app.close().catch((error: unknown) => {
            cleanupErrors.push(error);
          });
        }
        if (!cleanupErrors.length) removeContextTokenFixture(fixture);
      }
      await remote?.close().catch((error: unknown) => {
        cleanupErrors.push(error);
      });
      await provider.close().catch((error: unknown) => {
        cleanupErrors.push(error);
      });
      failures.push(...cleanupErrors);
    }
    if (failures.length)
      throw new AggregateError(failures, 'Reference journey, evidence or teardown failed');
  });
}
