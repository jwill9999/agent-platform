import { getMcpServer, McpConfigurationError, resolveMcpConnection } from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { validateMcpTools } from '@agent-platform/harness';
import { openMcpSession, safeMcpFailure } from '@agent-platform/mcp-adapter';

/** Read-only discovery using precisely the resolver and trust filter used by chat. */
export async function testMcpConnection(db: DrizzleDb, id: string, signal?: AbortSignal) {
  const started = Date.now();
  let stage: 'configuration' | 'connect' | 'discovery' = 'configuration';
  let configurationRevision = getMcpServer(db, id)?.configurationRevision ?? 0;
  try {
    const connection = resolveMcpConnection(db, id);
    configurationRevision = connection.configurationRevision ?? 0;
    stage = 'connect';
    const session = await openMcpSession(connection, { signal });
    try {
      stage = 'discovery';
      const discovered = await session.listContractTools({ signal });
      const filtered = validateMcpTools(connection.id, discovered);
      return {
        status: 'ok' as const,
        discoveredCount: discovered.length,
        eligibleCount: filtered.safe.length,
        toolCount: filtered.safe.length,
        // Names are useful for assignment. Do not echo arbitrary descriptions or rejection text.
        tools: filtered.safe.map((tool) => ({ name: tool.name })),
        rejections: filtered.rejected.length
          ? [{ category: 'trust_policy', count: filtered.rejected.length }]
          : [],
        latencyMs: Date.now() - started,
        testedAt: new Date().toISOString(),
        configurationRevision,
      };
    } finally {
      await session.close().catch(() => {});
    }
  } catch (error) {
    const failureStage = stage === 'configuration' ? 'connect' : stage;
    const safe =
      error instanceof McpConfigurationError ? error : safeMcpFailure(error, failureStage);
    return {
      status: 'error' as const,
      code: safe.code,
      error: safe.message,
      stage,
      retryGuidance:
        'Correct the configuration on the API execution host, then explicitly test again.',
      latencyMs: Date.now() - started,
      testedAt: new Date().toISOString(),
      configurationRevision,
    };
  }
}
