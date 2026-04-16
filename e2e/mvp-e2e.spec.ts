import { expect, test } from '@playwright/test';

const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';

test.describe('MVP E2E (compose-backed)', () => {
  test('API health', async ({ request }) => {
    const res = await request.get(`${apiURL}/health`);
    expect(res.ok()).toBeTruthy();
  });

  test('default agent exists after seed', async ({ request }) => {
    const res = await request.get(`${apiURL}/v1/agents`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { data: unknown };
    const agents = body.data as { slug: string }[];
    expect(Array.isArray(agents)).toBeTruthy();
    expect(agents.some((a) => a.slug === 'default-agent')).toBeTruthy();
  });

  test('E2E seed: specialist, MCP, skill', async ({ request }) => {
    const res = await request.get(`${apiURL}/v1/agents`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { data: unknown };
    const agents = body.data as { slug: string }[];
    expect(agents.some((a) => a.slug === 'e2e-specialist')).toBeTruthy();

    const mcpRes = await request.get(`${apiURL}/v1/mcp-servers`);
    expect(mcpRes.ok()).toBeTruthy();
    const mcpBody = (await mcpRes.json()) as { data: { slug: string }[] };
    expect(mcpBody.data.some((m) => m.slug === 'e2e-filesystem-mcp')).toBeTruthy();

    const skillRes = await request.get(`${apiURL}/v1/skills`);
    expect(skillRes.ok()).toBeTruthy();
    const skillBody = (await skillRes.json()) as { data: { slug: string }[] };
    expect(skillBody.data.some((s) => s.slug === 'e2e-skill')).toBeTruthy();
  });

  test('home page chat smoke', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible();
  });

  test('tool_result panel renders (fixture page)', async ({ page }) => {
    await page.goto('/e2e/verify');
    await expect(page.getByRole('heading', { name: 'E2E verify' })).toBeVisible();
    await expect(page.locator('.output-tool-result')).toBeVisible();
    await expect(page.locator('.output-tool-result').getByText('e2e-fs:read_file')).toBeVisible();
  });
});
