import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { CODING_AGENT_ID, openDatabase, runSeed } from '@agent-platform/db';
import { createObservabilityStore } from '@agent-platform/plugin-observability';
import request from 'supertest';
import type { Application } from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/infrastructure/http/createApp.js';

function createSeededApp(dirs: string[]): {
  app: Application;
  sqlite: ReturnType<typeof openDatabase>['sqlite'];
  observabilityStore: ReturnType<typeof createObservabilityStore>;
} {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-sensors-'));
  dirs.push(dir);
  const sqlitePath = path.join(dir, 'db.sqlite');
  const { db, sqlite } = openDatabase(sqlitePath);
  runSeed(db);
  const observabilityStore = createObservabilityStore();
  return { app: createApp({ db, v1: { observabilityStore } }), sqlite, observabilityStore };
}

describe('session sensor dashboard endpoint', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0;
  });

  it('exposes active profile, providers, findings, runtime limits, and retry guidance', async () => {
    const { app, sqlite, observabilityStore } = createSeededApp(dirs);

    try {
      const sessionRes = await request(app)
        .post('/v1/sessions')
        .send({ agentId: CODING_AGENT_ID })
        .expect(201);
      const sessionId = sessionRes.body.data.id as string;

      observabilityStore.record({
        kind: 'sensor_run',
        sessionId,
        runId: 'run-1',
        trigger: 'before_push',
        agentProfile: 'coding',
        taskContexts: ['repo_change'],
        records: [
          {
            id: 'collector:sonarqube:before_push',
            sensorId: 'collector:sonarqube',
            sessionId,
            runId: 'run-1',
            trigger: 'before_push',
            selectedForProfile: 'coding',
            selectionState: 'optional',
            status: 'completed',
            startedAtMs: 1_000,
            completedAtMs: 2_000,
            result: {
              sensorId: 'collector:sonarqube',
              status: 'failed',
              severity: 'high',
              summary: 'Imported 1 finding from SonarQube.',
              findings: [
                {
                  source: 'sonarqube_remote',
                  severity: 'high',
                  status: 'open',
                  category: 'security',
                  message: 'Review untrusted path handling.',
                  file: 'packages/harness/src/security/pathJail.ts',
                  line: 42,
                  ruleId: 'typescript:S0001',
                  dedupeKey: 'sonar:path-jail',
                  evidence: [],
                  metadata: {},
                },
              ],
              repairInstructions: [
                {
                  summary: 'Address imported SonarQube finding.',
                  actions: [
                    {
                      kind: 'fix_code',
                      label: 'Fix SonarQube finding',
                      file: 'packages/harness/src/security/pathJail.ts',
                      line: 42,
                    },
                  ],
                },
              ],
              evidence: [],
              terminalEvidence: [],
              runtimeLimitations: [],
              metadata: {},
              completedAtMs: 2_000,
            },
          },
        ],
        results: [
          {
            sensorId: 'collector:sonarqube',
            status: 'failed',
            severity: 'high',
            summary: 'Imported 1 finding from SonarQube.',
            findings: [
              {
                source: 'sonarqube_remote',
                severity: 'high',
                status: 'open',
                category: 'security',
                message: 'Review untrusted path handling.',
                file: 'packages/harness/src/security/pathJail.ts',
                line: 42,
                ruleId: 'typescript:S0001',
                dedupeKey: 'sonar:path-jail',
                evidence: [],
                metadata: {},
              },
            ],
            repairInstructions: [{ summary: 'Address imported SonarQube finding.' }],
            evidence: [],
            terminalEvidence: [],
            providerAvailability: {
              provider: 'sonarqube',
              capability: 'issues',
              state: 'available',
              repairActions: [],
            },
            runtimeLimitations: [
              {
                kind: 'sandbox_policy_denied',
                message: 'The sandbox blocked IDE terminal-output access.',
                repairActions: [{ kind: 'ask_user', label: 'Review sandbox policy' }],
              },
            ],
            metadata: {},
            completedAtMs: 2_000,
          },
        ],
        providerAvailability: [
          {
            provider: 'github',
            capability: 'check_runs',
            state: 'auth_required',
            message: 'Run gh auth login before importing GitHub checks.',
            repairActions: [
              {
                kind: 'authenticate_cli',
                label: 'Authenticate GitHub CLI',
                command: ['gh', 'auth', 'login'],
              },
              { kind: 'retry', label: 'Retry GitHub discovery' },
            ],
          },
          {
            provider: 'sonarqube',
            capability: 'issues',
            state: 'available',
            repairActions: [],
          },
        ],
        runtimeLimitations: [
          {
            kind: 'sandbox_policy_denied',
            message: 'The sandbox blocked IDE terminal-output access.',
            repairActions: [{ kind: 'ask_user', label: 'Review sandbox policy' }],
          },
        ],
        mcpCapabilities: [
          {
            serverId: 'sonarqube',
            capability: 'issues',
            state: 'available',
            selectedForReflection: true,
          },
        ],
      });

      const res = await request(app).get(`/v1/sessions/${sessionId}/sensors`).expect(200);

      expect(res.body.data.activeAgentProfile).toBe('coding');
      expect(res.body.data.codingSensorsRequired).toBe(true);
      expect(res.body.data.definitions.length).toBeGreaterThan(0);
      expect(res.body.data.providerAvailability).toContainEqual(
        expect.objectContaining({ provider: 'github', state: 'auth_required' }),
      );
      expect(res.body.data.findings).toContainEqual(
        expect.objectContaining({
          sensorId: 'collector:sonarqube',
          source: 'sonarqube_remote',
          status: 'open',
        }),
      );
      expect(res.body.data.runtimeLimitations).toContainEqual(
        expect.objectContaining({ kind: 'sandbox_policy_denied' }),
      );
      expect(res.body.data.mcpCapabilities).toContainEqual(
        expect.objectContaining({ serverId: 'sonarqube', selectedForReflection: true }),
      );
      expect(res.body.data.setupGuidance).toContainEqual(
        expect.objectContaining({ provider: 'github', state: 'auth_required' }),
      );

      const retryRes = await request(app)
        .post(`/v1/sessions/${sessionId}/sensors/retry`)
        .expect(200);
      expect(retryRes.body.data.sessionId).toBe(sessionId);
    } finally {
      sqlite.close();
    }
  });
});
