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
    await expect(page.locator('h2', { hasText: 'AI Studio' })).toBeVisible();
  });

  test('sessions move from sidebar panel to header dropdown', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Open sessions menu' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse panel' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Open sessions menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Manage sessions' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'New chat with current agent' })).toBeVisible();
  });

  test('sidebar shows Chat/IDE and settings overflow menu', async ({ page }) => {
    await page.goto('/');

    const sidebar = page.locator('aside').first();
    await expect(sidebar.getByRole('link', { name: 'Chat' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'IDE' })).toBeVisible();

    await expect(sidebar.getByRole('link', { name: 'Agents' })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Tools' })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Sessions' })).toHaveCount(0);

    await sidebar.getByRole('button', { name: 'Open settings menu' }).click();

    await expect(page.getByRole('menuitem', { name: 'Agents' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Tools' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Sessions' })).toBeVisible();
  });

  test('tool_result panel renders (fixture page)', async ({ page }) => {
    await page.goto('/e2e/verify');
    await expect(page.getByRole('heading', { name: 'E2E verify' })).toBeVisible();
    await expect(page.locator('.output-tool-result')).toBeVisible();
    await expect(page.locator('.output-tool-result').getByText('e2e-fs:read_file')).toBeVisible();
  });

  test('assistant text renders without bubble while feedback stays visible', async ({ page }) => {
    await page.goto('/e2e/feedback-only');

    await expect(page.getByRole('heading', { name: 'E2E feedback-only verify' })).toBeVisible();
    await expect(page.getByText('User message bubble should remain visible.')).toBeVisible();

    await expect(page.getByText(/^Thinking$/)).toHaveCount(2);
    await expect(page.getByText('Placement thinking trace.')).toBeVisible();
    await expect(page.getByText('Streaming turn thinking trace.')).toBeVisible();

    await expect(page.locator('strong', { hasText: 'coding class' }).first()).toBeVisible();
    const programmingBasicsItem = page.locator('li', { hasText: 'Programming basics' }).first();
    await expect(programmingBasicsItem).toBeVisible();

    await expect(page.getByText('Critic Review')).toBeVisible();
    await expect(
      page.getByText('Response accepted by critic. Showing final assessment.'),
    ).toBeVisible();
    await expect(
      page.getByText('This final assessment must remain hidden while streaming.'),
    ).toHaveCount(0);

    const thinkingBox = await page.getByText('Placement thinking trace.').boundingBox();
    const outputBox = await programmingBasicsItem.boundingBox();
    const criticBox = await page.getByText('Critic Review').boundingBox();

    expect(thinkingBox).not.toBeNull();
    expect(outputBox).not.toBeNull();
    expect(criticBox).not.toBeNull();

    expect(thinkingBox!.y).toBeLessThan(outputBox!.y);
    expect(outputBox!.y).toBeLessThan(criticBox!.y);

    await expect(page.getByTestId('critic-badge')).toHaveCount(0);
  });
});
