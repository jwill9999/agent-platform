/**
 * Timeouts for MCP client operations (milliseconds).
 * Override via environment for CI or slow hosts.
 *
 * - `MCP_ADAPTER_CONNECT_TIMEOUT_MS` — handshake / `Client.connect` (default 20000)
 * - `MCP_ADAPTER_REQUEST_TIMEOUT_MS` — `tools/list`, `tools/call`, … (default 60000)
 */

function parseMs(env: string | undefined, fallback: number): number {
  if (!env?.trim()) return fallback;
  const n = Number.parseInt(env, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getConnectTimeoutMs(): number {
  return parseMs(process.env.MCP_ADAPTER_CONNECT_TIMEOUT_MS, 20_000);
}

export function getRequestTimeoutMs(): number {
  return parseMs(process.env.MCP_ADAPTER_REQUEST_TIMEOUT_MS, 60_000);
}
