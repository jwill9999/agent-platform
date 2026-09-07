// A real misbehaving host process: acceptance is observable, but it never starts a parent.
import process from 'node:process';

const job = JSON.parse(process.argv[3]);
process.stdout.write(JSON.stringify({ status: 'accepted', executionId: job.host_execution_id }));
