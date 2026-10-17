import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { app, safeStorage } from 'electron';

const deadline = setTimeout(() => {
  console.error('Native secure-storage check exceeded its 60-second diagnostic deadline.');
  app.exit(1);
}, 60_000);

// Exercise native initialization directly, without an environment key, fixture protector or delay.
app.whenReady().then(async () => {
  try {
    assert.equal(process.platform, 'darwin', 'This check requires macOS secure storage');
    assert.equal(process.env.SECRETS_MASTER_KEY, undefined, 'Run without a master-key override');
    const availability = safeStorage.isAsyncEncryptionAvailable();
    assert.equal(typeof availability?.then, 'function', 'Availability must return a Promise');
    assert.equal(await availability, true, 'Native secure storage must be available at startup');
    const sample = 'Agent Platform native secure-storage regression';
    const encrypted = await safeStorage.encryptStringAsync(sample);
    const decrypted = await safeStorage.decryptStringAsync(encrypted);
    assert.equal(decrypted.result, sample, 'Native encryption must roundtrip');
    console.log(
      JSON.stringify({
        check: 'macos-secure-storage',
        electron: process.versions.electron,
        asynchronousAvailability: true,
        roundtrip: true,
      }),
    );
    clearTimeout(deadline);
    app.quit();
  } catch {
    clearTimeout(deadline);
    console.error(
      'Native secure-storage startup check failed; no application credentials were used.',
    );
    app.exit(1);
  }
});
