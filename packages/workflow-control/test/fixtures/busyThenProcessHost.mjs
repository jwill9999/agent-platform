import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const [database, operation, json] = process.argv.slice(2);
const job = JSON.parse(json);
if (operation === 'observe') {
  process.stdout.write(JSON.stringify({ status: job.attempts === 1 ? 'busy' : 'missing' }));
} else {
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL('../../dist/continuationProcess.js', import.meta.url)),
      database,
      job.id,
      job.host_execution_id,
      String(job.lease_epoch),
    ],
    { stdio: 'ignore' },
  );
  child.once('spawn', () => {
    child.unref();
    process.stdout.write(
      JSON.stringify({ status: 'accepted', executionId: job.host_execution_id }),
    );
  });
  child.once('error', () => {
    process.exitCode = 1;
  });
}
