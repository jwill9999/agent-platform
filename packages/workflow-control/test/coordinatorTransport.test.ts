import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { CoordinatorTransport } from '../src/coordinatorTransport.js';
const roots: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function transport(body: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'coordinator-transport-')));
  roots.push(root);
  const path = join(root, 'adapter');
  writeFileSync(path, `#!${realpathSync(process.execPath)}\n${body}`);
  chmodSync(path, 0o700);
  const pin = {
    path,
    digest: `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`,
  };
  return { path, port: new CoordinatorTransport(pin) };
}
it('calls a pinned adapter with structured input and no inherited host credentials', async () => {
  const { port } = transport(
    `let input='';process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>console.log(JSON.stringify({args:process.argv.slice(2), input:JSON.parse(input), env:process.env})));`,
  );
  vi.stubEnv('WORKFLOW_TEST_HOST_CREDENTIAL', 'disposable-sentinel');
  const output = await port.call<{ args: string[]; input: unknown; env: Record<string, string> }>(
    'beads.readIssue',
    { taskId: 'task' },
    () => {},
  );
  // macOS libc may add this locale value to an otherwise empty child environment.
  delete output.env.__CF_USER_TEXT_ENCODING;
  expect(output).toEqual({
    args: ['workflow-coordinator-v1', 'beads.readIssue'],
    input: { taskId: 'task' },
    env: {},
  });
});
it('rejects adapter changes and revoked authority before dispatch', async () => {
  const { port, path } = transport('console.log("{}")');
  await expect(
    port.call('beads.readIssue', {}, () => {
      throw Error('revoked');
    }),
  ).rejects.toThrow('revoked');
  writeFileSync(path, 'changed');
  await expect(port.call('beads.readIssue', {}, () => {})).rejects.toThrow();
});
it('does not accept a reply after authority is revoked', async () => {
  const { port } = transport('console.log("{}")');
  let checks = 0;
  await expect(
    port.call('beads.readIssue', {}, () => {
      if (++checks > 1) throw Error('revoked');
    }),
  ).rejects.toThrow('authority_invalid');
});
it('stops an active direct adapter process and rejects subsequent dispatch', async () => {
  const { port } = transport('setInterval(()=>{},1000)');
  const pending = port.call('beads.readIssue', {}, () => {});
  const rejected = expect(pending).rejects.toThrow('unavailable');
  port.abort();
  await rejected;
  await expect(port.call('beads.readIssue', {}, () => {})).rejects.toThrow('stopped');
});
it('terminates forked descendants on abort before accepting another operation', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'coordinator-descendant-')));
  roots.push(root);
  const marker = join(root, 'late-effect');
  const ready = join(root, 'ready');
  const childProgram = `require('node:fs').writeFileSync(${JSON.stringify(ready)},'ready');setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad'),400);setInterval(()=>{},1000);`;
  const { port } = transport(
    `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(childProgram)}],{stdio:'ignore'});setInterval(()=>{},1000);`,
  );
  const pending = port.call('beads.readIssue', {}, () => {});
  const rejected = expect(pending).rejects.toThrow('unavailable');
  for (let n = 0; n < 100; n++) {
    try {
      readFileSync(ready);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  expect(readFileSync(ready, 'utf8')).toBe('ready');
  port.abort();
  await rejected;
  await new Promise((resolve) => setTimeout(resolve, 600));
  expect(() => readFileSync(marker)).toThrow();
});
