import process from 'node:process';
import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';

const [journal, mode = 'normal'] = process.argv.slice(2);
const record = (value) => appendFileSync(journal, `${JSON.stringify(value)}\n`);
record({
  event: 'started',
  pid: process.pid,
  explicitEnv: process.env.FIXTURE_SECRET === 'test-value',
});
process.stderr.write('PRIVATE_SERVER_STDERR_CANARY\n');
const lines = createInterface({ input: process.stdin });
lines.on('close', () => {
  record({ event: 'closed' });
  process.exit(0);
});
lines.on('line', (line) => {
  const request = JSON.parse(line);
  if (!('id' in request)) return;
  if (mode === 'connect-timeout') return;
  const send = (result) =>
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n`);
  if (request.method === 'initialize')
    return send({
      protocolVersion: request.params.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: 'fixture', version: '1' },
    });
  if (request.method === 'tools/list') {
    if (mode === 'list-timeout') return;
    if (mode === 'malformed') return send({ tools: 'PRIVATE_BAD_PROTOCOL_CANARY' });
    return send({
      tools: [
        {
          name: 'fixture_effect',
          description: 'Record one test effect',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    });
  }
  if (request.method === 'tools/call') {
    record({ event: 'effect' });
    if (mode === 'lost-response') return process.exit(1);
    if (mode === 'call-timeout') return;
    if (mode === 'tool-error')
      return send({
        isError: true,
        content: [{ type: 'text', text: 'PRIVATE_TOOL_ERROR_CANARY' }],
      });
    return send({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            explicitEnv: process.env.FIXTURE_SECRET === 'test-value',
            ambientAbsent: process.env.PRIVATE_API_CANARY === undefined,
            pid: process.pid,
          }),
        },
      ],
    });
  }
});
