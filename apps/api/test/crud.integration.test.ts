import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  closeDatabase,
  DEFAULT_AGENT_ID,
  DEMO_SKILL_ID,
  openDatabase,
  runSeed,
  tools as toolsTable,
} from '@agent-platform/db';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/infrastructure/http/createApp.js';

describe('REST /v1 (integration)', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0;
  });

  it('lists seeded skills and default agent; CRUD tool + session', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-api-'));
    dirs.push(dir);
    const sqlitePath = path.join(dir, 'db.sqlite');
    const { db, sqlite } = openDatabase(sqlitePath);
    runSeed(db);
    const app = createApp({ db });

    const skillsRes = await request(app).get('/v1/skills').expect(200);
    expect(skillsRes.body.data.some((s: { id: string }) => s.id === DEMO_SKILL_ID)).toBe(true);

    const agentsRes = await request(app).get('/v1/agents').expect(200);
    expect(agentsRes.body.data.some((a: { id: string }) => a.id === DEFAULT_AGENT_ID)).toBe(true);

    const createToolRes = await request(app)
      .post('/v1/tools')
      .send({
        name: 'Extra tool',
      })
      .expect(201);

    const toolsRes = await request(app).get('/v1/tools').expect(200);
    expect(toolsRes.body.data.some((tool: { id: string }) => tool.id === 'sys_query_logs')).toBe(
      true,
    );
    expect(
      toolsRes.body.data.some((tool: { id: string }) => tool.id === 'sys_query_recent_errors'),
    ).toBe(true);
    expect(toolsRes.body.data.some((tool: { id: string }) => tool.id === 'sys_inspect_trace')).toBe(
      true,
    );

    const toolSlug = createToolRes.body.data.slug as string;
    const toolGet = await request(app).get(`/v1/tools/${toolSlug}`).expect(200);
    expect(toolGet.body.data.name).toBe('Extra tool');

    const builtInToolRes = await request(app).get('/v1/tools/sys-query-recent-errors').expect(200);
    expect(builtInToolRes.body.data.id).toBe('sys_query_recent_errors');

    const reservedCreateRes = await request(app)
      .post('/v1/tools')
      .send({ name: 'sys query recent errors' })
      .expect(409);
    expect(reservedCreateRes.body.error.code).toBe('RESERVED_TOOL_SLUG');

    const reservedUpdateRes = await request(app)
      .put(`/v1/tools/${toolSlug}`)
      .send({ name: 'sys query recent errors' })
      .expect(409);
    expect(reservedUpdateRes.body.error.code).toBe('RESERVED_TOOL_SLUG');

    const sessionRes = await request(app)
      .post('/v1/sessions')
      .send({ agentId: DEFAULT_AGENT_ID })
      .expect(201);
    const sid = sessionRes.body.data.id as string;
    expect(sessionRes.body.data.agentId).toBe(DEFAULT_AGENT_ID);

    await request(app).get(`/v1/sessions/${sid}`).expect(200);
    await request(app).get(`/v1/sessions?agentId=${DEFAULT_AGENT_ID}`).expect(200);

    closeDatabase(sqlite);
  });

  it('returns 404 for missing /v1 resource', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-api-'));
    dirs.push(dir);
    const { db, sqlite } = openDatabase(path.join(dir, 'd.sqlite'));
    runSeed(db);
    const app = createApp({ db });
    await request(app).get('/v1/skills/nope').expect(404);
    closeDatabase(sqlite);
  });

  it('deduplicates legacy system slug collisions and rejects ambiguous slug lookup', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-api-'));
    dirs.push(dir);
    const sqlitePath = path.join(dir, 'db.sqlite');
    const { db, sqlite } = openDatabase(sqlitePath);
    runSeed(db);
    db.insert(toolsTable)
      .values({
        id: randomUUID(),
        slug: 'sys-query-recent-errors',
        name: 'Legacy colliding tool',
      })
      .run();
    const app = createApp({ db });

    const toolsRes = await request(app).get('/v1/tools').expect(200);
    expect(
      toolsRes.body.data.filter(
        (tool: { slug: string }) => tool.slug === 'sys-query-recent-errors',
      ),
    ).toHaveLength(1);

    const collisionRes = await request(app).get('/v1/tools/sys-query-recent-errors').expect(409);
    expect(collisionRes.body.error.code).toBe('AMBIGUOUS_TOOL_SLUG');

    closeDatabase(sqlite);
  });
});
