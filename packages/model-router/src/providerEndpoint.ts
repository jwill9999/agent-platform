/** Remote endpoints require TLS. Only explicit loopback addresses can use HTTP. */
export function normalizeProviderEndpoint(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid provider endpoint');
  }
  const loopback =
    url.hostname === 'localhost' ||
    url.hostname === '[::1]' ||
    /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
  if (
    value.includes('?') ||
    value.includes('#') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
  ) {
    throw new Error(
      'Provider endpoint requires HTTPS or loopback HTTP without credentials, query or fragment',
    );
  }
  return url.toString().replace(/\/$/, '');
}
/** Never forward a credential-bearing SDK request through a redirect. */
export const providerFetch: typeof fetch = (input, init) =>
  globalThis.fetch(input, { ...init, redirect: 'error' });
