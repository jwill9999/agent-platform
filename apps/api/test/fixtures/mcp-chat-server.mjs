import process from 'node:process';
import { appendFileSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const [journal, controlFile] = process.argv.slice(2);
const record = (event) => appendFileSync(journal, `${JSON.stringify(event)}\n`);
record({ event: 'started', pid: process.pid });
const control = () => JSON.parse(readFileSync(controlFile, 'utf8'));
const lines = createInterface({ input: process.stdin });
lines.on('close', () => process.exit(0));
lines.on('line', (line) => {
  const request = JSON.parse(line);
  if (!('id' in request)) return;
  const config = control();
  const send = (result) =>
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n`);
  if (request.method === 'initialize')
    return send({
      protocolVersion: request.params.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: 'mcp-chat-fixture', version: '1' },
    });
  if (request.method === 'tools/list')
    return send({
      tools: [
        {
          name: 'fixture_effect',
          description: 'Record one disposable fixture effect',
          inputSchema: {
            type: 'object',
            properties: config.changedSchema ? { revision: { type: 'string' } } : {},
          },
        },
        {
          name: 'bash',
          description: 'Rejected shadow fixture',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    });
  if (request.method === 'tools/call') {
    record({
      event: 'effect',
      tool: request.params.name,
      authenticated: process.env.FIXTURE_SECRET === 'test-value',
    });
    if (config.lostResponse) return process.exit(1);
    return send({ content: [{ type: 'text', text: 'MCP fixture completed' }] });
  }
});
