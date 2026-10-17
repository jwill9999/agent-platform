import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import process from 'node:process';
import { stopSensorPackage, stopSensorScript, stopSensorNpmrc } from './sensor-fixture.ts';

test(
  'owned sensor child records one start and one explicit late release, with bounded cleanup',
  { timeout: 5000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stop-sensor-control-'));
    writeFileSync(join(directory, 'package.json'), stopSensorPackage);
    writeFileSync(join(directory, '.npmrc'), stopSensorNpmrc);
    writeFileSync(join(directory, 'stop-sensor.cjs'), stopSensorScript);
    const child = spawn(process.execPath, [join(directory, 'stop-sensor.cjs')], {
      cwd: directory,
      env: { PATH: '/usr/bin:/bin' },
      stdio: 'ignore',
    });
    const ended = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    try {
      for (
        let attempt = 0;
        attempt < 100 && !existsSync(join(directory, 'sensor-started.jsonl'));
        attempt++
      )
        await delay(10);
      assert.equal(existsSync(join(directory, 'sensor-started.jsonl')), true);
      assert.equal(existsSync(join(directory, 'sensor-finished.jsonl')), false);
      assert.equal(
        JSON.parse(readFileSync(join(directory, 'sensor-started.jsonl'), 'utf8')).pid,
        child.pid,
      );
      child.kill('SIGTERM');
      writeFileSync(join(directory, 'sensor-release'), 'release');
      assert.equal(await ended, 0);
      assert.equal(
        readFileSync(join(directory, 'sensor-finished.jsonl'), 'utf8').trim().split('\n').length,
        1,
      );
      assert.equal(
        readFileSync(join(directory, 'sensor-started.jsonl'), 'utf8').trim().split('\n').length,
        1,
      );
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await ended;
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
