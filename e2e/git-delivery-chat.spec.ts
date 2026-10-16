import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createDockerGitBoundary } from './support/git-delivery/docker-boundary';
import { startDockerGitProvider } from './support/git-delivery/docker-provider';
import {
  createGitChatSession,
  openGitChat,
  runGitChatJourney,
  gitChatModel,
  gitChatReplies,
  type GitChatApi,
  type GitChatScenario,
} from './support/git-delivery/chat-journey';

test.use({ trace: 'on' });
const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';
for (const scenario of [
  'success',
  'denied',
  'unknown',
] as const satisfies readonly GitChatScenario[]) {
  test(`Docker chat Git delivery ${scenario} preserves review, hidden-rail recovery and real effects`, async ({
    page,
  }, info) => {
    // Existing shared API limiter: up to two observed one-minute resets, never mutation retries.
    test.setTimeout(180_000);
    let attachmentSequence = 0;
    const attachJson = async (name: string, value: unknown) => {
      const path = info.outputPath(`${++attachmentSequence}-${name}.json`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(value, null, 2));
      await info.attach(name, { path, contentType: 'application/json' });
    };
    const pace = async (minimum: number) => {
      const rendererOrigin = page.url().startsWith('http')
        ? new URL(page.url()).origin
        : new URL(info.project.use.baseURL ?? 'http://127.0.0.1:3001').origin;
      // Probe the actual renderer/BFF path, not the direct fixture setup bucket.
      const budgetUrl = `${rendererOrigin}/api/v1/settings`;
      const response = await page.request.get(budgetUrl);
      expect([200, 429]).toContain(response.status());
      const header = response.headers()['ratelimit'];
      const remaining = Number(header?.match(/remaining=(\d+)/)?.[1]);
      const reset = Number(header?.match(/reset=(\d+)/)?.[1]);
      expect(Number.isFinite(remaining) && Number.isFinite(reset)).toBe(true);
      if (remaining < minimum) {
        const waitMs = reset * 1000 + 100;
        expect(waitMs).toBeLessThanOrEqual(61_000);
        await attachJson('request-budget-pacing', {
          url: response.url(),
          rendererOrigin,
          transport: 'browser-context request through renderer BFF',
          status: response.status(),
          rateHeader: header,
          remaining,
          waitMs,
        });
        await delay(waitMs);
        const recovered = await page.request.get(budgetUrl);
        expect(recovered.ok()).toBe(true);
        await attachJson('request-budget-recovered', {
          url: recovered.url(),
          status: recovered.status(),
          rateHeader: recovered.headers()['ratelimit'],
        });
        expect(
          Number(recovered.headers()['ratelimit']?.match(/remaining=(\d+)/)?.[1]),
        ).toBeGreaterThanOrEqual(minimum);
      }
    };
    await pace(90);
    const owned: Array<[string, string]> = [];
    const api: GitChatApi = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
      const response = await fetch(`${apiURL}/v1/${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', ...init.headers },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok)
        throw new Error(
          `Owned API ${init.method ?? 'GET'} ${path}: ${response.status} ${(await response.text()).slice(0, 2048)}`,
        );
      if (response.status === 204) return undefined as T;
      const body = await response.json();
      if (init.method === 'POST') {
        if (['model-configs', 'agents', 'sessions'].includes(path))
          owned.unshift([path, body.data.id]);
        if (path === 'projects/desktop/register') owned.unshift(['projects', body.data.project.id]);
      }
      return body.data as T;
    };
    const branch = `feature/chat-${scenario}`;
    let boundary: ReturnType<typeof createDockerGitBoundary> | undefined;
    let provider: Awaited<ReturnType<typeof startDockerGitProvider>> | undefined;
    const failures: unknown[] = [];
    try {
      const fixture = createDockerGitBoundary(apiURL, branch);
      boundary = fixture;
      provider = await startDockerGitProvider({
        apiURL,
        model: gitChatModel,
        replies: gitChatReplies(scenario),
      });
      const identity = await createGitChatSession(
        api,
        boundary.directory,
        `git-chat-${scenario}-${randomUUID()}`,
      );
      await openGitChat(page, identity);
      const diagnosticDenial = async () => {
        const result = await page.evaluate(async (sessionId) => {
          const response = await fetch('/api/diagnostics/report', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ scope: { sessionId } }),
          });
          return { status: response.status, body: await response.json() };
        }, identity.session.id);
        expect(result.status).toBe(403);
        expect(result.body.error.code).toBe('DIAGNOSTICS_DENIED');
        await attachJson('compose-diagnostic-access', result);
      };
      const result = await runGitChatJourney({
        page,
        api,
        boundary: {
          ...fixture,
          loseNextCreateResponse: () => {
            fixture.loseNextCreateResponse();
          },
        },
        projectId: identity.projectId,
        sessionId: identity.session.id,
        branch,
        scenario,
        waiting: diagnosticDenial,
        beforePr: () => pace(65),
      });
      expect(provider.errors).toEqual([]);
      // Rejection resumes with a truthful tool-result explanation; an uncertain effect halts the loop.
      await expect
        .poll(() => provider!.requests.length)
        .toBe(scenario === 'success' ? 5 : scenario === 'unknown' ? 4 : 2);
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
      }
      await diagnosticDenial();
      await attachJson('chat-delivery-result', {
        scenario,
        sessionId: identity.session.id,
        ...result,
      });
      await attachJson('github-boundary-ledger', boundary.ledger());
    } catch (error) {
      failures.push(error);
    }
    // These independent handles remain valid after a failed Playwright step or closed page.
    try {
      await provider?.close();
    } catch (error) {
      failures.push(error);
    }
    if (provider) {
      if (provider.errors.length)
        failures.push(new Error(`Owned provider rejected requests: ${provider.errors.join('; ')}`));
      try {
        await attachJson('owned-model-ledger', {
          requests: provider.requests,
          errors: provider.errors,
        });
      } catch (error) {
        failures.push(error);
      }
    }
    for (const [resource, id] of owned) {
      try {
        await api(`${resource}/${id}`, { method: 'DELETE' });
      } catch (error) {
        failures.push(error);
      }
    }
    try {
      boundary?.close();
    } catch (error) {
      failures.push(error);
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
