const URL = globalThis.URL;
// Loaded only by the provider journey subprocesses. Fail closed on remote SDK fetches.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  let address;
  if (typeof input === 'string') address = input;
  else if (input instanceof URL) address = input.href;
  else address = input.url;
  const url = new URL(address);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Provider journey forbids non-loopback fetch');
  }
  return originalFetch(input, init);
};
