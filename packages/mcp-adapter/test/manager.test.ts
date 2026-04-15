import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { McpServer } from '@agent-platform/contracts';
import type { McpSession } from '../src/session.js';
import { McpSessionManager } from '../src/manager.js';

// Mock the openMcpSession function
vi.mock('../src/session.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/session.js')>();
  return {
    ...actual,
    openMcpSession: vi.fn(),
  };
});

import { openMcpSession } from '../src/session.js';
const mockOpen = vi.mocked(openMcpSession);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSession(): McpSession {
  return {
    listContractTools: vi.fn(async () => []),
    callToolAsOutput: vi.fn(async () => ({ type: 'text' as const, content: 'ok' })),
    close: vi.fn(async () => {}),
  };
}

const server1: McpServer = { id: 'srv-1', name: 'Server 1', transport: 'stdio', command: 'node' };
const server2: McpServer = { id: 'srv-2', name: 'Server 2', transport: 'stdio', command: 'node' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('McpSessionManager', () => {
  describe('openSessions', () => {
    it('opens multiple sessions in parallel and returns results', async () => {
      const session1 = createMockSession();
      const session2 = createMockSession();
      mockOpen.mockResolvedValueOnce(session1).mockResolvedValueOnce(session2);

      const manager = new McpSessionManager();
      const results = await manager.openSessions([server1, server2]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ serverId: 'srv-1', status: 'connected' });
      expect(results[1]).toEqual({ serverId: 'srv-2', status: 'connected' });
      expect(manager.getSession('srv-1')).toBe(session1);
      expect(manager.getSession('srv-2')).toBe(session2);
    });

    it('handles partial failure — successful sessions still cached', async () => {
      const session1 = createMockSession();
      mockOpen
        .mockResolvedValueOnce(session1)
        .mockRejectedValueOnce(new Error('Connection refused'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = new McpSessionManager();
      const results = await manager.openSessions([server1, server2]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ serverId: 'srv-1', status: 'connected' });
      expect(results[1]).toEqual({
        serverId: 'srv-2',
        status: 'failed',
        error: 'Connection refused',
      });

      expect(manager.getSession('srv-1')).toBe(session1);
      expect(manager.getSession('srv-2')).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect to MCP server "srv-2"'),
      );

      warnSpy.mockRestore();
    });

    it('handles all failures gracefully', async () => {
      mockOpen.mockRejectedValue(new Error('Network error'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = new McpSessionManager();
      const results = await manager.openSessions([server1, server2]);

      expect(results.every((r) => r.status === 'failed')).toBe(true);
      expect(manager.getSessions().size).toBe(0);

      warnSpy.mockRestore();
    });

    it('returns empty array for empty configs', async () => {
      const manager = new McpSessionManager();
      const results = await manager.openSessions([]);

      expect(results).toEqual([]);
      expect(mockOpen).not.toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('returns undefined for unknown server id', () => {
      const manager = new McpSessionManager();
      expect(manager.getSession('unknown')).toBeUndefined();
    });
  });

  describe('isHealthy', () => {
    it('returns true for connected sessions', async () => {
      mockOpen.mockResolvedValue(createMockSession());

      const manager = new McpSessionManager();
      await manager.openSessions([server1]);

      expect(manager.isHealthy('srv-1')).toBe(true);
      expect(manager.isHealthy('srv-unknown')).toBe(false);
    });
  });

  describe('reconnect', () => {
    it('opens a new session for a previously failed server', async () => {
      const session = createMockSession();
      mockOpen.mockResolvedValue(session);

      const manager = new McpSessionManager();
      const success = await manager.reconnect('srv-1', server1);

      expect(success).toBe(true);
      expect(manager.getSession('srv-1')).toBe(session);
    });

    it('closes existing session before reconnecting', async () => {
      const oldSession = createMockSession();
      const newSession = createMockSession();
      mockOpen.mockResolvedValueOnce(oldSession).mockResolvedValueOnce(newSession);

      const manager = new McpSessionManager();
      await manager.openSessions([server1]);
      expect(manager.getSession('srv-1')).toBe(oldSession);

      const success = await manager.reconnect('srv-1', server1);

      expect(success).toBe(true);
      expect(oldSession.close).toHaveBeenCalledOnce();
      expect(manager.getSession('srv-1')).toBe(newSession);
    });

    it('returns false on reconnect failure', async () => {
      mockOpen.mockRejectedValue(new Error('Still down'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const manager = new McpSessionManager();
      const success = await manager.reconnect('srv-1', server1);

      expect(success).toBe(false);
      expect(manager.getSession('srv-1')).toBeUndefined();

      warnSpy.mockRestore();
    });
  });

  describe('closeAll', () => {
    it('closes all active sessions and clears the cache', async () => {
      const session1 = createMockSession();
      const session2 = createMockSession();
      mockOpen.mockResolvedValueOnce(session1).mockResolvedValueOnce(session2);

      const manager = new McpSessionManager();
      await manager.openSessions([server1, server2]);
      expect(manager.getSessions().size).toBe(2);

      await manager.closeAll();

      expect(session1.close).toHaveBeenCalledOnce();
      expect(session2.close).toHaveBeenCalledOnce();
      expect(manager.getSessions().size).toBe(0);
    });

    it('swallows errors during close', async () => {
      const session = createMockSession();
      (session.close as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('close failed'));
      mockOpen.mockResolvedValue(session);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = new McpSessionManager();
      await manager.openSessions([server1]);

      // Should not throw
      await manager.closeAll();

      expect(manager.getSessions().size).toBe(0);
      warnSpy.mockRestore();
    });

    it('is safe to call on empty manager', async () => {
      const manager = new McpSessionManager();
      await expect(manager.closeAll()).resolves.toBeUndefined();
    });
  });

  describe('getSessions', () => {
    it('returns read-only view of sessions', async () => {
      const session = createMockSession();
      mockOpen.mockResolvedValue(session);

      const manager = new McpSessionManager();
      await manager.openSessions([server1]);

      const sessions = manager.getSessions();
      expect(sessions.size).toBe(1);
      expect(sessions.get('srv-1')).toBe(session);
    });
  });
});
