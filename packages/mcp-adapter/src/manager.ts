import type { McpServer } from '@agent-platform/contracts';
import { createLogger } from '@agent-platform/logger';
import type { McpSession } from './session.js';
import { openMcpSession } from './session.js';

const log = createLogger('mcp-adapter');

export type McpSessionOpenResult = {
  serverId: string;
  status: 'connected' | 'failed';
  error?: string;
};

/**
 * Manages MCP session lifecycle — parallel opening, caching, health checks, cleanup.
 *
 * Per-request scoped for MVP: each `AgentContext` gets its own manager instance.
 */
export class McpSessionManager {
  private readonly sessions = new Map<string, McpSession>();

  /** Read-only view of currently connected sessions. */
  getSessions(): ReadonlyMap<string, McpSession> {
    return this.sessions;
  }

  /**
   * Opens sessions to multiple MCP servers in parallel.
   * Failures are collected and logged — they do not prevent other sessions from opening.
   */
  async openSessions(configs: McpServer[]): Promise<McpSessionOpenResult[]> {
    if (configs.length === 0) return [];

    const settled = await Promise.allSettled(
      configs.map(async (config) => {
        const session = await openMcpSession(config);
        return { config, session };
      }),
    );

    const results: McpSessionOpenResult[] = [];

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]!;
      const config = configs[i]!;

      if (outcome.status === 'fulfilled') {
        this.sessions.set(config.id, outcome.value.session);
        results.push({ serverId: config.id, status: 'connected' });
      } else {
        const error =
          outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
        log.warn('Failed to connect to MCP server', {
          serverId: config.id,
          transport: config.transport,
          error,
        });
        results.push({ serverId: config.id, status: 'failed', error });
      }
    }

    return results;
  }

  /** Retrieve a cached session by server ID. */
  getSession(serverId: string): McpSession | undefined {
    return this.sessions.get(serverId);
  }

  /** Basic health check: session exists in the cache. */
  isHealthy(serverId: string): boolean {
    return this.sessions.has(serverId);
  }

  /**
   * Attempt to re-open a failed or disconnected session.
   * Closes the old session if one exists before opening a new one.
   * Always keys on `config.id` to avoid serverId/config.id mismatch.
   */
  async reconnect(config: McpServer): Promise<boolean> {
    const existing = this.sessions.get(config.id);
    if (existing) {
      try {
        await existing.close();
      } catch {
        // Ignore close errors during reconnect
      }
      this.sessions.delete(config.id);
    }

    try {
      const session = await openMcpSession(config);
      this.sessions.set(config.id, session);
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.warn('Reconnect failed', {
        serverId: config.id,
        transport: config.transport,
        error,
      });
      return false;
    }
  }

  /** Close all active sessions. Errors during close are swallowed. */
  async closeAll(): Promise<void> {
    const entries = [...this.sessions.entries()];
    this.sessions.clear();

    await Promise.allSettled(
      entries.map(async ([serverId, session]) => {
        try {
          await session.close();
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          log.warn('Error closing session', { serverId, error });
        }
      }),
    );
  }
}
