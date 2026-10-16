/** Private monitoring transport. The capability stays in main and never enters IPC results. */
export const maximumMonitoringBytes = 5 * 1024 * 1024;
export type MonitoringTransportDependencies = {
  apiBaseUrl: string;
  capability?: string;
  fetchImpl?: typeof fetch;
};

export function monitoringApi(deps: MonitoringTransportDependencies): URL {
  try {
    const api = new URL(deps.apiBaseUrl);
    if (
      api.protocol === 'http:' &&
      ['127.0.0.1', '[::1]'].includes(api.hostname) &&
      !api.username &&
      !api.password &&
      /^[a-f0-9]{64}$/.test(deps.capability ?? '')
    )
      return api;
  } catch {
    // Do not echo URLs or secrets in renderer-visible errors.
  }
  throw new Error('Local monitoring is unavailable in this connection.');
}

async function readBounded(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Monitoring response was empty.');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    // Sequential bounded reads apply backpressure before retaining each next chunk.
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maximumMonitoringBytes) {
        await reader.cancel();
        throw new Error('Monitoring response exceeds its safe size limit.');
      }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally {
    reader.releaseLock();
  }
}

export async function monitoringPost<T>(
  action: 'status' | 'preference' | 'window',
  payload: unknown,
  parse: (value: unknown) => T,
  deps: MonitoringTransportDependencies,
): Promise<T> {
  const api = monitoringApi(deps);
  try {
    const response = await (deps.fetchImpl ?? fetch)(
      new URL(`/v1/diagnostics/monitoring/${action}`, api),
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: {
          'Content-Type': 'application/json',
          'x-diagnostics-capability': deps.capability!,
        },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) throw new Error('Monitoring request failed.');
    return parse(await readBounded(response));
  } catch {
    // Transport, parser and server failures may contain arbitrary payloads or secrets.
    throw new Error(
      'Local monitoring could not be read or updated. Refresh its status before retrying.',
    );
  }
}
