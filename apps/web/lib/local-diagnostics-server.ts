function localHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' &&
      ['127.0.0.1', '[::1]'].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}
/** Server-only deployment and browser-origin boundary; never serialize the capability. */
export function localDiagnosticConnection(
  request: Request,
): { api: URL; capability: string } | null {
  const capability = process.env.DIAGNOSTICS_LOCAL_CAPABILITY;
  const host = process.env.DIAGNOSTICS_WEB_HOST;
  const origin = host ? localHttpUrl(`http://${host}`) : null;
  const api = localHttpUrl(process.env.API_PROXY_URL ?? '');
  if (
    process.env.DIAGNOSTICS_LOCAL_TOPOLOGY !== 'loopback' ||
    !origin ||
    !api ||
    !capability ||
    !/^[a-f0-9]{64}$/.test(capability)
  )
    return null;
  if (
    request.headers.get('host') !== host ||
    request.headers.get('origin') !== origin.origin ||
    request.headers.get('sec-fetch-site') !== 'same-origin' ||
    request.headers.get('content-type')?.split(';')[0] !== 'application/json'
  )
    return null;
  return { api, capability };
}
