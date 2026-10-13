import type { ResolvedMcpConnection } from '@agent-platform/contracts';
import { createLogger } from '@agent-platform/logger';
import { safeMcpFailure } from './errors.js';
import type { McpSession, McpOperationOptions } from './session.js';
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
  private operations: Promise<void> = Promise.resolve();

  /** Serialize ownership changes so concurrent open/close cannot orphan a transport. */
  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation);
    this.operations = result.then(
      () => {},
      () => {},
    );
    return result;
  }

  /** Read-only view of currently connected sessions. */
  getSessions(): ReadonlyMap<string, McpSession> {
    return this.sessions;
  }

  /**
   * Opens sessions to multiple MCP servers in parallel.
   * Failures are collected and logged — they do not prevent other sessions from opening.
   */
  async openSessions(
    configs: ResolvedMcpConnection[],
    options: McpOperationOptions = {},
  ): Promise<McpSessionOpenResult[]> {
    return this.mutate(() => this.openUniqueSessions(configs, options));
  }

  private async openUniqueSessions(
    configs: ResolvedMcpConnection[],
    options: McpOperationOptions,
  ): Promise<McpSessionOpenResult[]> {
    // A manager owns one request snapshot per server. Repeated opens reuse it; replacement is explicit.
    const unique = [...new Map(configs.map((config) => [config.id, config])).values()];
    if (unique.length === 0) return [];

    const settled = await Promise.allSettled(
      unique.map(async (config) => {
        const session = this.sessions.get(config.id) ?? (await openMcpSession(config, options));
        return { config, session };
      }),
    );

    const results: McpSessionOpenResult[] = [];

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]!;
      const config = unique[i]!;

      if (outcome.status === 'fulfilled') {
        this.sessions.set(config.id, outcome.value.session);
        results.push({ serverId: config.id, status: 'connected' });
      } else {
        const error = safeMcpFailure(outcome.reason, 'connect').message;
        log.warn('Failed to connect to MCP server', {
          serverId: config.id,
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
  async reconnect(
    config: ResolvedMcpConnection,
    options: McpOperationOptions = {},
  ): Promise<boolean> {
    return this.mutate(() => this.replaceSession(config, options));
  }

  private async replaceSession(
    config: ResolvedMcpConnection,
    options: McpOperationOptions,
  ): Promise<boolean> {
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
      const session = await openMcpSession(config, options);
      this.sessions.set(config.id, session);
      return true;
    } catch (err) {
      const error = safeMcpFailure(err, 'connect').message;
      log.warn('Reconnect failed', {
        serverId: config.id,
        error,
      });
      return false;
    }
  }

  /** Close all active sessions. Errors during close are swallowed. */
  async closeAll(): Promise<void> {
    return this.mutate(() => this.closeOwnedSessions());
  }

  private async closeOwnedSessions(): Promise<void> {
    const entries = [...this.sessions.entries()];
    this.sessions.clear();

    await Promise.allSettled(
      entries.map(async ([serverId, session]) => {
        try {
          await session.close();
        } catch (err) {
          const error = safeMcpFailure(err, 'connect').message;
          log.warn('Error closing session', { serverId, error });
        }
      }),
    );
  }
}
