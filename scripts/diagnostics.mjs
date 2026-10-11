#!/usr/bin/env node
/** Local-only diagnostics reader. Credentials are accepted through private environment only. */
import { pathToFileURL, URL } from 'node:url';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import {
  DiagnosticHealthSchema,
  DiagnosticScopeSchema,
  DiagnosticStoredEventSchema,
  projectDiagnosticReport,
} from '../packages/contracts/dist/index.js';

function projectList(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Object.keys(input).some((key) => !['events', 'health'].includes(key)) ||
    !Array.isArray(input.events) ||
    input.events.length > 100
  )
    throw new Error('invalid_list');
  return {
    events: input.events.map((event) => DiagnosticStoredEventSchema.parse(event)),
    health: DiagnosticHealthSchema.parse(input.health),
  };
}
const maxBytes = 5 * 1024 * 1024;
const usage =
  'Usage: pnpm diagnostics list [--json] | report (--request UUID | --session UUID [--run UUID]) [--json]';

function parseArguments(args) {
  const [command, ...rest] = args;
  if (command !== 'list' && command !== 'report') throw new Error('invalid_arguments');
  const options = new Map();
  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index];
    if (!['--request', '--session', '--run', '--json'].includes(option) || options.has(option))
      throw new Error('invalid_arguments');
    if (option === '--json') options.set(option, true);
    else {
      const value = rest[++index];
      if (!value || value.startsWith('--')) throw new Error('invalid_arguments');
      options.set(option, value);
    }
  }
  if (command === 'list') {
    if ([...options.keys()].some((key) => key !== '--json')) throw new Error('invalid_arguments');
    return { command, json: options.has('--json'), body: { limit: 25 } };
  }
  const scope = Object.fromEntries(
    [
      ['requestId', options.get('--request')],
      ['sessionId', options.get('--session')],
      ['runId', options.get('--run')],
    ].filter(([, value]) => value !== undefined),
  );
  const parsed = DiagnosticScopeSchema.safeParse(scope);
  if (!parsed.success) throw new Error('invalid_arguments');
  return { command, json: options.has('--json'), body: { scope: parsed.data } };
}

function localEndpoint(env, command) {
  let url;
  try {
    url = new URL(env.DIAGNOSTICS_API_URL ?? 'http://127.0.0.1:3000');
  } catch {
    throw new Error('invalid_configuration');
  }
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('invalid_configuration');
  const capability = env.DIAGNOSTICS_LOCAL_CAPABILITY;
  if (!/^[a-f0-9]{64}$/.test(capability ?? '')) throw new Error('invalid_configuration');
  url.pathname = `/v1/diagnostics/${command}`;
  return { url, capability };
}

async function readBounded(response) {
  if (!response.ok || !response.body) throw new Error('diagnostics_unavailable');
  const length = Number(response.headers.get('content-length'));
  if (length > maxBytes) {
    await response.body.cancel();
    throw new Error('response_limit');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('response_limit');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

export async function runDiagnostics(
  args,
  env = process.env,
  output = process.stdout,
  errors = process.stderr,
) {
  try {
    const options = parseArguments(args);
    const { url, capability } = localEndpoint(env, options.command);
    const response = await globalThis.fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal: globalThis.AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/json', 'x-diagnostics-capability': capability },
      body: JSON.stringify(options.body),
    });
    const input = await readBounded(response);
    if (options.command === 'list') {
      const list = projectList(input);
      const text = options.json
        ? JSON.stringify(list, null, 2)
        : [
            `Recent local diagnostic events (${list.health.state}; ${list.health.dropped} dropped, ${list.health.pending} pending).`,
            ...list.events.map(
              ({ sequence, event }) =>
                `${sequence}. ${event.phase}: ${event.outcome}; request ${event.requestId}${event.sessionId ? `; session ${event.sessionId}` : ''}${event.runId ? `; run ${event.runId}` : ''}`,
            ),
          ].join('\n');
      output.write(`${text}\n`);
    } else {
      const report = projectDiagnosticReport(input);
      if (JSON.stringify(report.scope) !== JSON.stringify(options.body.scope)) {
        // Compare fields independently of property insertion order.
        const fields = ['requestId', 'sessionId', 'runId'];
        if (fields.some((key) => report.scope[key] !== options.body.scope[key]))
          throw new Error('scope_mismatch');
      }
      output.write(`${options.json ? JSON.stringify(report, null, 2) : report.summary}\n`);
    }
    return 0;
  } catch (error) {
    // Never print server bodies, URLs, environment values or library error details.
    const argumentError = error instanceof Error && error.message === 'invalid_arguments';
    errors.write(
      argumentError
        ? `${usage}\n`
        : 'Diagnostics unavailable. Check the local API, private capability and requested scope. No report was produced.\n',
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runDiagnostics(process.argv.slice(2));
}
