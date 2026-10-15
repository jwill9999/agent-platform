import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createDockerGitBoundary } from './support/git-delivery/docker-boundary';
import { runRemotePanelJourney } from './support/git-delivery/panel-remote-journey';

test.use({ trace: 'on' });
const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';

test('Docker Project reviews publishing and recovers a lost PR response without replay', async ({
  page,
  request,
}, testInfo) => {
  // At most two real one-minute rate-limit windows, plus bounded fixture/journey work.
  test.setTimeout(180_000);
  const pace = async (minimum: number) => {
    const response = await request.get(`${apiURL}/v1/settings`);
    const header = response.headers()['ratelimit'];
    const remaining = Number(header?.match(/remaining=(\d+)/)?.[1]);
    const reset = Number(header?.match(/reset=(\d+)/)?.[1]);
    expect(Number.isFinite(remaining) && Number.isFinite(reset)).toBe(true);
    if (remaining < minimum) {
      const waitMs = reset * 1000 + 100;
      expect(waitMs).toBeLessThanOrEqual(61_000);
      await testInfo.attach('request-budget-pacing', {
        body: JSON.stringify({ remaining, waitMs }),
        contentType: 'application/json',
      });
      await delay(waitMs);
    }
  };
  await pace(85);
  const branch = 'feature/reviewed-remote';
  const fixture = createDockerGitBoundary(apiURL, branch);
  const name = `git-remote-${randomUUID()}`;
  const owned: [string, string][] = [];
  let primary: unknown;
  try {
    const model = await request.post(`${apiURL}/v1/model-configs`, {
      data: { name, provider: 'ollama', model: `${name}-no-model-call` },
    });
    expect(model.ok()).toBe(true);
    const modelConfigId = (await model.json()).data.id;
    owned.unshift(['model-configs', modelConfigId]);
    const agent = await request.post(`${apiURL}/v1/agents`, {
      data: {
        name,
        modelConfigId,
        systemPrompt: 'Disposable panel-only fixture; no model requests.',
        allowedSkillIds: [],
        allowedToolIds: [],
        allowedMcpServerIds: [],
        pluginAllowlist: [],
        executionLimits: { maxSteps: 2, maxParallelTasks: 1, timeoutMs: 30_000 },
      },
    });
    expect(agent.ok()).toBe(true);
    const agentId = (await agent.json()).data.id;
    owned.unshift(['agents', agentId]);
    const project = await request.post(`${apiURL}/v1/projects/desktop/register`, {
      headers: { 'x-agent-platform-desktop-bridge': '1' },
      data: { name, path: fixture.directory },
    });
    expect(project.ok()).toBe(true);
    const projectId = (await project.json()).data.project.id;
    owned.unshift(['projects', projectId]);
    const session = await request.post(`${apiURL}/v1/sessions`, {
      data: { agentId, mode: 'project', projectId },
    });
    expect(session.ok()).toBe(true);
    const sessionId = (await session.json()).data.id;
    owned.unshift(['sessions', sessionId]);
    await page.goto(`/?projectId=${projectId}&sessionId=${sessionId}`);
    const input = page.getByPlaceholder('Ask about this Project...');
    await expect(input).toBeEnabled();
    await input.fill('/init');
    const send = page.getByRole('button', { name: 'Send message', exact: true });
    await expect(send).toBeEnabled();
    await send.click();
    await page.getByRole('button', { name: 'Approve instructions' }).click();
    await expect(page.getByText('Project instructions approved').last()).toBeVisible();
    const history = await request.get(`${apiURL}/v1/projects/${projectId}/git/delivery`);
    expect(history.ok()).toBe(true);
    expect((await history.json()).data.operations).toEqual([]);
    fixture.git('add', '--', 'AGENTS.md');
    fixture.git('commit', '-m', 'fixture approved instructions');
    fixture.write('feature.txt', 'reviewed feature\n');
    fixture.git('add', '--', 'feature.txt');
    fixture.git('commit', '-m', 'fixture feature');
    const result = await runRemotePanelJourney(page, fixture, branch, () => pace(65));
    await testInfo.attach('remote-delivery-result', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('github-boundary-ledger', {
      body: JSON.stringify(fixture.ledger(), null, 2),
      contentType: 'application/json',
    });
  } catch (error) {
    primary = error;
  }
  const failures: unknown[] = primary ? [primary] : [];
  for (const [resource, id] of owned) {
    try {
      const response = await fetch(`${apiURL}/v1/${resource}/${id}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Owned ${resource} cleanup failed: HTTP${response.status}`);
    } catch (error) {
      failures.push(error);
    }
  }
  try {
    fixture.close();
  } catch (error) {
    failures.push(error);
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      failures.map((error) => (error instanceof Error ? error.message : String(error))).join('\n'),
    );
});
