// Offline Responses transport only. Never logs request headers or credentials.
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { zstdDecompressSync } from 'node:zlib';
function findPrompt(value) {
  if (typeof value === 'string') {
    try {
      return findPrompt(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  if (!value || typeof value !== 'object') return undefined;
  if (value.input?.task?.assignedRole) return value;
  for (const entry of Object.values(value)) {
    const found = findPrompt(entry);
    if (found) return found;
  }
}
const implementations = new Set();
let injected = false;
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
  const prompt = findPrompt(body.input);
  if (!prompt) throw new Error('fixture input envelope missing');
  const role = prompt.input.task.assignedRole;
  const implementation = role === 'implementation_worker';
  if (implementation) implementations.add(prompt.input.binding.executionDigest);
  const content =
    implementations.size > 1 ? 'verified repaired change\n' : 'verified fixture change\n';
  const hasToolResult = body.input.some((item) => item.type === 'custom_tool_call_output');
  const toolTurn = !hasToolResult && ['implementation_worker', 'test_runner'].includes(role);
  const observed =
    implementation ||
    prompt.sourceEvidence?.some(
      (file) => file.path === 'packages/workflow-control/example.txt' && file.content === content,
    ) ||
    body.input.some(
      (item) =>
        item.type === 'custom_tool_call_output' &&
        JSON.stringify(item.output).includes(content.trim()),
    );
  const fail = !toolTurn && !injected && process.env.WORKFLOW_FIXTURE_REPAIR === role;
  if (fail) injected = true;
  const terminal = {
    status: fail ? 'needs_repair' : observed ? 'passed' : 'blocked',
    summary: 'Offline implementation complete',
    changedFiles: implementation ? ['packages/workflow-control/example.txt'] : [],
    acceptanceCriteria: fail
      ? { passed: [], failed: ['durable'] }
      : { passed: ['durable'], failed: [] },
    evidence: [],
    findings: fail
      ? [
          {
            id: 'fixture-repair',
            severity: 'high',
            summary: 'Controlled failure requires a new implementation',
            repairHypothesis: 'Write the corrected fixture content and verify it',
            evidence: [
              {
                digest: 'sha256:' + 'a'.repeat(64),
                mediaType: 'text/plain',
                sizeBytes: 1,
                kind: 'test',
              },
            ],
          },
        ]
      : [],
    remainingRisks: [],
    recommendedTransition: fail ? 'repair' : role === 'code_reviewer' ? 'integrate' : 'continue',
  };
  const item = toolTurn
    ? {
        type: 'custom_tool_call',
        id: 'ct_patch',
        call_id: 'call_patch',
        name: 'exec',
        namespace: 'functions',
        input:
          'text(await tools.exec_command({cmd:' +
          JSON.stringify(
            implementation
              ? `printf '%s' '${content}' > /workspace/packages/workflow-control/example.txt`
              : 'cat /workspace/packages/workflow-control/example.txt',
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
