import { describe, expect, it } from 'vitest';

import { SessionCreateBodySchema, SessionRecordSchema } from '../src/session.js';

describe('session contracts', () => {
  it('defaults created sessions to chat mode when no mode is provided', () => {
    expect(SessionCreateBodySchema.parse({ agentId: 'agent-1' })).toMatchObject({
      agentId: 'agent-1',
      mode: 'chat',
    });
  });

  it('accepts explicit project mode and exposes mode on persisted session records', () => {
    expect(
      SessionCreateBodySchema.parse({
        agentId: 'agent-1',
        mode: 'project',
        projectId: 'project-1',
      }),
    ).toMatchObject({
      agentId: 'agent-1',
      mode: 'project',
      projectId: 'project-1',
    });

    expect(
      SessionRecordSchema.parse({
        id: 'session-1',
        agentId: 'agent-1',
        mode: 'project',
        projectId: 'project-1',
        createdAtMs: 1,
        updatedAtMs: 1,
      }),
    ).toMatchObject({ mode: 'project', projectId: 'project-1' });
  });
});
