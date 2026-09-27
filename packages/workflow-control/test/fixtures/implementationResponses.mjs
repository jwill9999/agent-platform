// Offline Responses transport only. Never logs request headers or credentials.
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { zstdDecompressSync } from 'node:zlib';
let step = 0;
createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let body;
  try {
    const raw = Buffer.concat(chunks);
    body = JSON.parse(
      (req.headers['content-encoding'] === 'zstd' ? zstdDecompressSync(raw) : raw).toString(),
    );
  } catch {
    /* Discovery request. */
  }
  if (!body?.input) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"models":[]}');
    return;
  }
  const terminal = {
    status: 'passed',
    summary: 'Offline implementation complete',
    changedFiles: ['packages/workflow-control/example.txt'],
    acceptanceCriteria: { passed: ['durable'], failed: [] },
    evidence: [],
    findings: [],
    remainingRisks: [],
    recommendedTransition: 'continue',
  };
  const item =
    step++ === 0
      ? {
          type: 'custom_tool_call',
          id: 'ct_patch',
          call_id: 'call_patch',
          name: 'exec',
          namespace: 'functions',
          input:
            'text(await tools.exec_command({cmd:' +
            JSON.stringify(
              String.raw`printf 'verified fixture change\n' > /workspace/packages/workflow-control/example.txt`,
            ) +
            '}));',
        }
      : {
          type: 'message',
          id: 'msg_done',
          role: 'assistant',
          content: [{ type: 'output_text', text: JSON.stringify(terminal) }],
        };
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  for (const event of [
    { type: 'response.created', response: { id: 'resp_fixture' } },
    { type: 'response.output_item.added', output_index: 0, item },
    { type: 'response.output_item.done', output_index: 0, item },
    {
      type: 'response.completed',
      response: {
        id: 'resp_fixture',
        status: 'completed',
        output: [item],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      },
    },
  ])
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  res.end();
}).listen(18103, '0.0.0.0');
