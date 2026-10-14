#!/usr/bin/env node
// Test-only external CLI. No network/process execution. Only explicitly owned Git roots work.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { setInterval, clearInterval } from 'node:timers';
const configPath = join(process.cwd(), '.git', 'github-read-control.json');
if (!existsSync(configPath)) process.exit(1);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (config.fixture !== 'github-read-responsiveness-v1') process.exit(2);
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--version') {
  console.log('gh version 2.0.0 (owned deterministic fixture)');
  process.exit(0);
}
if (JSON.stringify(args) === JSON.stringify(['auth', 'status', '--hostname', 'github.com'])) {
  process.exit(0);
}
const kind = args[0] === 'pr' && ['view', 'list'].includes(args[1]) ? args[1] : undefined;
if (!kind || args[args.indexOf('--repo') + 1] !== 'fixture/github-read-owned') process.exit(3);
const epoch = config.epoch;
if (!/^[a-z0-9-]{1,64}$/.test(epoch)) process.exit(4);
const events = join(process.cwd(), '.git', 'github-read-events.jsonl');
const log = (event) =>
  appendFileSync(
    events,
    JSON.stringify({ event, epoch, kind, pid: process.pid, at: Date.now(), args }) + '\n',
  );
let settled = false;
let timer;
function exit(code, reason) {
  if (settled) return;
  settled = true;
  clearInterval(timer);
  log(reason);
  process.exit(code);
}
process.on('SIGTERM', () => exit(143, 'terminated'));
process.on('SIGINT', () => exit(130, 'terminated'));
function complete() {
  const rollup = [
    {
      __typename: 'CheckRun',
      name: 'owned-fixture-check',
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
      detailsUrl: 'https://github.com/fixture/github-read-owned/actions/runs/1',
    },
  ];
  const pr = {
    number: 71,
    title: 'Owned responsiveness PR',
    state: 'OPEN',
    url: 'https://github.com/fixture/github-read-owned/pull/71',
    headRefName: 'context-fixture',
    baseRefName: 'staging',
    author: { login: 'fixture' },
    isDraft: false,
    reviewDecision: 'APPROVED',
    mergeable: 'MERGEABLE',
    createdAt: '2026-10-14T00:00:00Z',
    updatedAt: '2026-10-14T00:00:00Z',
    statusCheckRollup: rollup,
  };
  console.log(JSON.stringify(kind === 'list' ? [pr] : pr));
  exit(0, 'completed');
}
log('ready');
if (config.mode === 'healthy') complete();
else if (config.mode === 'hold' || config.mode === 'timeout') {
  const began = Date.now();
  timer = setInterval(() => {
    if (existsSync(join(process.cwd(), '.git', 'github-read-release-' + epoch))) complete();
    // Eight seconds caps held-window proof. Timeout mode separately tests the production 10s deadline.
    if (Date.now() - began > (config.mode === 'timeout' ? 11_000 : 8_000))
      exit(5, 'safety-expired');
  }, 10);
} else exit(6, 'invalid-mode');
