import { open } from 'node:fs/promises';
import process from 'node:process';
import { setInterval, clearInterval } from 'node:timers';

// Runtime strings are data, including the module URL. Never interpolate them into executable source.
const [moduleURL, root, id, blocked] = process.argv.slice(2);
const { createCaptureFailureRecorder } = await import(moduleURL);
const recorder = createCaptureFailureRecorder({ appDataPath: root, processInstanceId: id });
await recorder.ready;
if (blocked === 'true' || blocked === 'hold') {
  const handle = await open(root + '/prototype', 'w', 0o600);
  const prototype = Object.getPrototypeOf(handle);
  await handle.close();
  const original = prototype.writeFile;
  prototype.writeFile = function (data, ...args) {
    if (typeof data !== 'string' || !data.startsWith('{'))
      return original.call(this, data, ...args);
    process.send({ stage: 'temporary' });
    return new Promise((resolve, reject) => {
      if (blocked === 'hold')
        process.once('message', () => original.call(this, data, ...args).then(resolve, reject));
    });
  };
}
recorder.observe('diagnostics', {
  schemaVersion: 1,
  processInstanceId: id,
  store: 'diagnostics',
  operation: 'startup',
  cause: 'worker_error',
  observedAtMs: 1000,
  elapsedMs: 25,
  deadlineMs: null,
});
const timer = setInterval(() => {
  const state = recorder.status().diagnostics.publication;
  if (state === 'pending') return;
  process.send({ stage: state });
  clearInterval(timer);
  process.disconnect();
}, 5);
