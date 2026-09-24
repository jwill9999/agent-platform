import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { prepareSupervisedReview, executeSupervisedReview } from '../src/supervisedReview.js';

const image = process.env.WORKFLOW_REVIEW_IMAGE;
const run = promisify(execFile);
const reports: unknown[] = [];
async function record(result: unknown) {
  reports.push(result);
  if (process.env.WORKFLOW_REVIEW_PROBE_REPORT)
    await writeFile(
      process.env.WORKFLOW_REVIEW_PROBE_REPORT,
      JSON.stringify(
        {
          image,
          sourceDigests: Object.fromEntries(
            await Promise.all(
              [
                '../src/supervisedReview.ts',
                '../src/reviewProxy.ts',
                '../dist/reviewProxy.js',
                '../src/specialistLauncher.ts',
                './fixtures/reviewerCapabilityProbe.mjs',
                './supervisedReviewCapabilities.integration.test.ts',
              ].map(async (path) => [
                path,
                createHash('sha256')
                  .update(await readFile(new URL(path, import.meta.url)))
                  .digest('hex'),
              ]),
            ),
          ),
          reports,
        },
        null,
        2,
      ) + '\n',
    );
}
it.skipIf(!image)(
  'captures client tool definitions and rejects injected patch, shell and delegation calls',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'review-capabilities-'));
    let staged: string | undefined;
    try {
      await writeFile(join(root, 'auth.json'), '{}');
      await copyFile(
        new URL('./fixtures/reviewerCapabilityProbe.mjs', import.meta.url),
        join(root, 'probe.mjs'),
      );
      const prepared = await prepareSupervisedReview({
        sourceRoot: root,
        evidencePaths: ['probe.mjs'],
        modelAuthFile: join(root, 'auth.json'),
        image: image!,
        egressNetwork: 'offline-probe',
        question: 'Offline fixture',
      });
      staged = dirname(prepared.snapshot.root);
      const args = prepared.launch.args.slice(0, -3);
      args[args.indexOf('--network') + 1] = 'none';
      args.push('node', '/workspace/probe.mjs');
      const { stdout } = await run(prepared.launch.dockerBinary, args, {
        env: {},
        timeout: 35000,
        maxBuffer: 200000,
      });
      const evidence = JSON.parse(stdout) as {
        inventories: { name: string; tools?: { name: string }[] }[][];
        outputs: { call_id: string; output: string }[];
        requestCount: number;
      };
      const names = [
        ...new Set(
          evidence.inventories
            .flat()
            .flatMap((t) => t.tools?.map((n) => `${t.name}.${n.name}`) ?? [t.name]),
        ),
      ].sort();
      expect(names).toEqual([
        'functions.exec',
        'functions.request_user_input',
        'functions.request_user_input_async',
        'functions.wait',
      ]);
      expect(names.some((n) => n.startsWith('collaboration.'))).toBe(false);
      const outputs = new Map(evidence.outputs.map((o) => [o.call_id, o.output]));
      expect(outputs.get('call_spawn')).toContain('unsupported call');
      expect(outputs.get('call_patch')).toMatch(/code.mode.*(?:unavailable|disabled)/i);
      expect(outputs.get('call_shell')).toContain('unsupported call');
      expect(evidence.requestCount).toBe(4);
      await record({
        kind: 'runtime-tool-probe',
        advertised: names,
        allInventories: [
          ...new Map(evidence.inventories.map((i) => [JSON.stringify(i), i])).values(),
        ],
        rejectedCalls: evidence.outputs,
        requestCount: evidence.requestCount,
        provider: 'offline deterministic Responses fixture',
        realCredentials: false,
      });
      await expect(stat(join(prepared.snapshot.root, 'unauthorized.txt'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      expect(await readFile(join(root, 'auth.json'), 'utf8')).toBe('{}');
    } finally {
      await rm(root, { recursive: true, force: true });
      if (staged) await rm(staged, { recursive: true, force: true });
    }
  },
  40000,
);

it.skipIf(!image)(
  'removes the real container and copied credentials after a model startup failure',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'review-failure-'));
    let staged: string | undefined;
    const network = `review-failure-${Date.now()}`;
    await run('docker', ['network', 'create', '--internal', network]);
    try {
      await writeFile(join(root, 'auth.json'), '{}');
      await writeFile(join(root, 'plan.md'), 'disposable evidence');
      const prepared = await prepareSupervisedReview({
        sourceRoot: root,
        evidencePaths: ['plan.md'],
        modelAuthFile: join(root, 'auth.json'),
        image: image!,
        egressNetwork: network,
        question: 'No model credentials; must fail',
      });
      staged = dirname(prepared.snapshot.root);
      await expect(
        executeSupervisedReview(prepared, { timeoutMs: 10000, maxOutputBytes: 20000 }),
      ).rejects.toThrow();
      await expect(stat(staged)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(
        run('docker', ['inspect', `workflow-specialist-${prepared.executionId}`]),
      ).rejects.toThrow();
      await record({ kind: 'real-startup-failure', containerRemoved: true, stagingRemoved: true });
    } finally {
      await run('docker', ['network', 'rm', network]);
      await rm(root, { recursive: true, force: true });
      if (staged) await rm(staged, { recursive: true, force: true });
    }
  },
  30000,
);

it.skipIf(!image)(
  'enforces read-only evidence, absent host grants and model-only network egress',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'review-network-'));
    let staged: string | undefined;
    const suffix = Date.now();
    const internal = `review-internal-${suffix}`;
    const outbound = `review-outbound-${suffix}`;
    const proxy = `review-proxy-${suffix}`;
    await run('docker', ['network', 'create', '--internal', internal]);
    await run('docker', ['network', 'create', outbound]);
    try {
      await writeFile(join(root, 'auth.json'), '{}');
      await writeFile(join(root, 'plan.md'), 'original');
      await writeFile(join(root, 'broker-grant.json'), 'DUMMY-NOT-A-REAL-GRANT');
      const prepared = await prepareSupervisedReview({
        sourceRoot: root,
        evidencePaths: ['plan.md'],
        modelAuthFile: join(root, 'auth.json'),
        image: image!,
        egressNetwork: internal,
        proxyUrl: 'http://model-proxy:8080',
        question: 'Offline boundary probe',
      });
      staged = dirname(prepared.snapshot.root);
      const proxyFile = join(staged, 'proxy.mjs');
      await copyFile(new URL('../dist/reviewProxy.js', import.meta.url), proxyFile);
      await run('docker', [
        'run',
        '--detach',
        '--rm',
        '--name',
        proxy,
        '--network',
        outbound,
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--user',
        `${process.getuid!()}:${process.getgid!()}`,
        '--volume',
        `${proxyFile}:/proxy.mjs:ro`,
        image!,
        'node',
        '/proxy.mjs',
      ]);
      await run('docker', ['network', 'connect', '--alias', 'model-proxy', internal, proxy]);
      const args = prepared.launch.args.slice(0, -3);
      args.push(
        'node',
        '--input-type=module',
        '-e',
        String.raw`
    import fs from 'node:fs';import net from 'node:net';import http from 'node:http';
    let writeDenied=false;try{fs.writeFileSync('/workspace/plan.md','changed');}catch(e){writeDenied=['EROFS','EACCES','EPERM'].includes(e.code);}
    const tunnel=target=>new Promise((resolve,reject)=>{const s=net.connect(8080,'model-proxy',()=>s.write('CONNECT '+target+' HTTP/1.1\r\nHost: '+target+'\r\n\r\n'));s.setTimeout(5000,()=>{s.destroy();reject(new Error('proxy timeout'));});s.once('error',reject);s.once('data',d=>{s.destroy();resolve(d.toString().split('\r\n')[0]);});});
    const model=await new Promise((resolve,reject)=>{const r=http.get('http://model-proxy:8080/models',{headers:{host:'unapproved.example'}},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);r.setTimeout(10000,()=>{r.destroy();reject(new Error('model gateway timeout'));});});
    const direct=await new Promise(resolve=>{const s=net.connect(443,'1.1.1.1',()=>{s.destroy();resolve(true);});s.setTimeout(1500,()=>{s.destroy();resolve(false);});s.once('error',()=>resolve(false));});
    console.log(JSON.stringify({writeDenied,content:fs.readFileSync('/workspace/plan.md','utf8'),grantVisible:fs.existsSync('/workspace/broker-grant.json'),dockerSocket:fs.existsSync('/var/run/docker.sock'),direct,denied:await tunnel('github.com:443'),allowedTunnel:await tunnel('chatgpt.com:443'),modelStatus:model}));
  `,
      );
      const { stdout } = await run(prepared.launch.dockerBinary, args, {
        env: {},
        timeout: 20000,
        maxBuffer: 4096,
      });
      const boundaries = JSON.parse(stdout);
      expect(boundaries).toEqual({
        writeDenied: true,
        content: 'original',
        grantVisible: false,
        dockerSocket: false,
        direct: false,
        denied: 'HTTP/1.1 403 Forbidden',
        allowedTunnel: 'HTTP/1.1 403 Forbidden',
        modelStatus: 401,
      });
      await record({ kind: 'docker-boundaries', ...boundaries });
    } finally {
      await run('docker', ['rm', '--force', proxy]).catch(() => {});
      await run('docker', ['network', 'rm', internal, outbound]);
      await rm(root, { recursive: true, force: true });
      if (staged) await rm(staged, { recursive: true, force: true });
    }
  },
  30000,
);
