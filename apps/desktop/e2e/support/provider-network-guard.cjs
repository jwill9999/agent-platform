const URL = globalThis.URL;
// Loaded only by the provider journey subprocesses. Fail closed on remote SDK fetches.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
  );
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Provider journey forbids non-loopback fetch');
  }
  return originalFetch(input, init);
};
