import { createServer } from 'node:http';
import type { execFile } from 'node:child_process';
import { createSystemToolExecutor } from '../src/systemTools.js';
import { createDockerSandboxCommandRunner } from '../src/commandRunner.js';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { PluginDispatcher } from '@agent-platform/plugin-sdk';
import type { McpSessionManager } from '@agent-platform/mcp-adapter';
import { createLlmReasonNode } from '../src/nodes/llmReason.js';
import { createToolDispatchNode } from '../src/nodes/toolDispatch.js';
import { createSensorCheckNode } from '../src/nodes/sensorCheck.js';
import { runComputationalSensors } from '../src/sensors/computationalSensorRunner.js';
import { RunStoppedError, type RunExecutionControl, invokeRunAction } from '../src/runControl.js';
import { withToolTimeout } from '../src/toolTimeout.js';
import { withRetry } from '../src/retry.js';
import type { HarnessStateType } from '../src/graphState.js';

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function controlFixture() {
  const controller = new AbortController();
  let stopped = false;
  const admitted: string[] = [];
  const pending = new Set<Promise<unknown>>();
  const control: RunExecutionControl = {
    assertActive() {
      if (stopped) throw new RunStoppedError();
    },
    invoke(kind, action) {
      this.assertActive();
      admitted.push(kind);
      const promise = action();
      pending.add(promise);
      return promise.finally(() => {
        pending.delete(promise);
      });
    },
  };
  return {
    control,
    admitted,
    pending,
    signal: controller.signal,
    stop() {
      stopped = true;
      controller.abort('user_stop');
    },
    config: { configurable: { runControl: control, signal: controller.signal } },
  };
}

function state(overrides: Partial<HarnessStateType> = {}): HarnessStateType {
  return {
    messages: [{ role: 'user', content: 'test' }],
    toolDefinitions: [],
    llmOutput: null,
    modelConfig: { provider: 'ollama', model: 'fixture' },
    trace: [],
    taskIndex: 0,
    halted: false,
    totalTokensUsed: 0,
    limits: { maxSteps: 5, timeoutMs: 10_000 },
    runId: 'run',
    sessionId: 'session',
    ...overrides,
  } as HarnessStateType;
}

function dispatcher(
  hook: 'onToolCall' | 'onPromptBuild',
  action: () => Promise<void>,
): PluginDispatcher {
  return {
    chain: [],
    onSessionStart: vi.fn(),
    onTaskStart: vi.fn(),
    onTaskEnd: vi.fn(),
    onError: vi.fn().mockResolvedValue(undefined),
    onToolCall: vi.fn(),
    onPromptBuild: vi.fn(),
    [hook]: action,
  };
}

function toolNode(
  executor = vi.fn().mockResolvedValue({ type: 'tool_result', toolId: 'echo', data: { ok: true } }),
  hooks?: PluginDispatcher,
) {
  return {
    executor,
    node: createToolDispatchNode({
      agent: {
        id: 'agent',
        slug: 'agent',
        name: 'agent',
        systemPrompt: '',
        allowedToolIds: ['echo'],
        allowedSkillIds: [],
        allowedMcpServerIds: [],
        executionLimits: { maxSteps: 5 },
      },
      tools: [{ id: 'echo', slug: 'echo', name: 'echo', riskTier: 'low' }],
      mcpManager: {} as McpSessionManager,
      nativeToolExecutor: executor,
      dispatcher: hooks,
    }),
  };
}
const calls = { kind: 'tool_calls' as const, calls: [{ id: 'call', name: 'echo', args: {} }] };

describe('shared run admission boundaries', () => {
  it('rechecks native routing after an asynchronous unsupported handler before file mutation', async () => {
    const fixture = controlFixture();
    const directory = await mkdtemp(join(tmpdir(), 'native-route-stop-'));
    const marker = join(directory, 'marker');
    const executor = createSystemToolExecutor({ workspaceRoot: directory });
    const pending = executor(
      'sys_append_file',
      { path: marker, content: 'unexpected' },
      { signal: fixture.signal, runControl: fixture.control },
    );
    fixture.stop();
    try {
      await expect(pending).rejects.toThrow(RunStoppedError);
      await expect(access(marker)).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('denies admission after an asynchronous tool hook, with no native effect', async () => {
    const fixture = controlFixture();
    const entered = barrier();
    const resume = barrier();
    const { node, executor } = toolNode(
      undefined,
      dispatcher('onToolCall', async () => {
        entered.release();
        await resume.promise;
      }),
    );
    const result = node(state({ llmOutput: calls }), fixture.config);
    await entered.promise;
    fixture.stop();
    resume.release();
    expect((await result).halted).toBe(true);
    expect(executor).not.toHaveBeenCalled();
    expect(fixture.admitted).toEqual([]);
  });

  it('retains completed tool results and admits no next tool after Stop', async () => {
    const fixture = controlFixture();
    let hooks = 0;
    const { node, executor } = toolNode(
      undefined,
      dispatcher('onToolCall', async () => {
        if (++hooks === 2) fixture.stop();
      }),
    );
    const output = await node(
      state({
        llmOutput: {
          kind: 'tool_calls',
          calls: [...calls.calls, { id: 'next', name: 'echo', args: {} }],
        },
      }),
      fixture.config,
    );
    expect(output.halted).toBe(true);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(fixture.pending.size).toBe(0);
    expect(output.messages?.[0]?.toolCallId).toBe('call');
    expect(output.messages?.[0]?.content).toContain('ok');
  });

  it('tracks the underlying noncooperative promise after timeout returns', async () => {
    const fixture = controlFixture();
    const resume = barrier();
    await expect(
      withToolTimeout(
        () => invokeRunAction(fixture.control, undefined, 'tool', () => resume.promise),
        5,
        'fixture',
      ),
    ).rejects.toThrow('timed out');
    expect(fixture.pending.size).toBe(1);
    resume.release();
    await Promise.resolve();
    await Promise.resolve();
    expect(fixture.pending.size).toBe(0);
  });

  it('passes the combined native signal and never labels Stop as a tool timeout', async () => {
    const fixture = controlFixture();
    const entered = barrier();
    const executor = vi.fn().mockImplementation(async (_id, _args, options) => {
      entered.release();
      await once(options.signal, 'abort');
      throw new DOMException('Cancelled', 'AbortError');
    });
    const { node } = toolNode(executor);
    const result = node(state({ llmOutput: calls }), fixture.config);
    await entered.promise;
    fixture.stop();
    const output = await result;
    expect(output.halted).toBe(true);
    expect(output.trace).toContainEqual({ type: 'stream_aborted', reason: 'user_stop' });
    expect(output.trace?.some((event) => event.type === 'tool_timeout')).toBe(false);
  });

  it('ends outer backoff without a second invocation', async () => {
    const fixture = controlFixture();
    const attempts = vi.fn().mockRejectedValue(new Error('retryable'));
    await expect(
      withRetry(
        attempts,
        {
          maxAttempts: 3,
          baseDelayMs: 500,
          maxDelayMs: 500,
          jitterFactor: 0,
          isRetryable: () => true,
        },
        () => fixture.stop(),
        { runControl: fixture.control, signal: fixture.signal },
      ),
    ).rejects.toThrow();
    expect(attempts).toHaveBeenCalledTimes(1);
  });

  it('identifies a restored durable stop fence even without an aborted in-memory controller', async () => {
    const fixture = controlFixture();
    fixture.control.assertActive = () => {
      throw new RunStoppedError();
    };
    const node = createSensorCheckNode();
    const result = await node(state({ sensorRequestedTrigger: 'before_push' }), fixture.config);
    expect(result.trace).toContainEqual({ type: 'stream_aborted', reason: 'user_stop' });
  });

  it('suppresses required sensors without recording a pass', async () => {
    const fixture = controlFixture();
    fixture.stop();
    const executor = vi.fn();
    const node = createSensorCheckNode({ runnerOptions: { qualityGateExecutor: executor } });
    const result = await node(
      state({ sensorRequestedTrigger: 'before_push', sensorChangedFiles: ['src/a.ts'] }),
      fixture.config,
    );
    expect(result.halted).toBe(true);
    expect(executor).not.toHaveBeenCalled();
    expect(result.sensorResults).toBeUndefined();
    expect(result.trace).toContainEqual({ type: 'stream_aborted', reason: 'user_stop' });
  });

  it('fences each computational command independently', async () => {
    const fixture = controlFixture();
    const effects: string[] = [];
    const promise = runComputationalSensors(
      { agentProfile: 'coding', trigger: 'before_push', repoPath: '.', changedFiles: ['src/a.ts'] },
      {
        runControl: fixture.control,
        signal: fixture.signal,
        qualityGateExecutor: async (_id, args) => {
          effects.push(String(args.profile));
          fixture.stop();
          return null;
        },
      },
    );
    await expect(promise).rejects.toThrow(RunStoppedError);
    expect(effects).toEqual(['typecheck']);
    expect(fixture.admitted).toEqual(['sensor']);
  });

  it('fences the real built-in sensor command after asynchronous path preparation', async () => {
    const fixture = controlFixture();
    const directory = await mkdtemp(join(tmpdir(), 'stop-sensor-'));
    const executable = join(directory, 'pnpm');
    const marker = join(directory, 'unexpected');
    await writeFile(executable, `#!/bin/sh\ntouch ${JSON.stringify(marker)}\n`, { mode: 0o700 });
    // The runner has already started async realpath resolution, but no command has been admitted.
    const result = runComputationalSensors(
      {
        agentProfile: 'coding',
        trigger: 'before_push',
        repoPath: directory,
        changedFiles: ['src/a.ts'],
      },
      {
        workspaceRoot: directory,
        pnpmBin: executable,
        runControl: fixture.control,
        signal: fixture.signal,
      },
    );
    fixture.stop();
    try {
      await expect(result).rejects.toThrow(RunStoppedError);
      expect(fixture.admitted).toEqual([]);
      await expect(access(marker)).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('command runner final admission', () => {
  it('does not spawn after asynchronous workspace preparation if Stop already committed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stop-command-'));
    const fixture = controlFixture();
    const execute = vi.fn();
    const runner = createDockerSandboxCommandRunner({
      execFile: execute as unknown as typeof execFile,
    });
    try {
      const result = runner.run({
        command: 'date',
        cwd: directory,
        workspace: { root: directory },
        env: { mode: 'explicit', variables: {} },
        timeoutMs: 100,
        maxOutputBytes: 100,
        audit: { toolId: 'sys_bash' },
        runControl: fixture.control,
        signal: fixture.signal,
      });
      fixture.stop();
      await expect(result).rejects.toThrow(RunStoppedError);
      expect(execute).not.toHaveBeenCalled();
      expect(fixture.admitted).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('mandatory authority failures', () => {
  it('does not disguise a failed tool admission as an effect failure', async () => {
    const fixture = controlFixture();
    const failure = new Error('control write failed');
    fixture.control.invoke = () => {
      throw failure;
    };
    const { node, executor } = toolNode();
    await expect(node(state({ llmOutput: calls }), fixture.config)).rejects.toBe(failure);
    expect(executor).not.toHaveBeenCalled();
  });
});

describe('actual pinned provider transport', () => {
  it('does not send a model request after asynchronous prompt preparation', async () => {
    const fixture = controlFixture();
    const entered = barrier();
    const resume = barrier();
    const node = createLlmReasonNode({
      dispatcher: dispatcher('onPromptBuild', async () => {
        entered.release();
        await resume.promise;
      }),
    });
    const result = node(state(), fixture.config);
    await entered.promise;
    fixture.stop();
    resume.release();
    expect((await result).halted).toBe(true);
    expect(fixture.admitted).toEqual([]);
  });

  it('serves a real 503 and stops in outer backoff with exactly one HTTP attempt', async () => {
    const fixture = controlFixture();
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(request.url ?? '');
      request.resume();
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'controlled overload', type: 'fixture' } }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('fixture unavailable');
    vi.stubEnv('OLLAMA_BASE_URL', `http://127.0.0.1:${address.port}/v1`);
    const hooks = dispatcher('onPromptBuild', async () => {});
    hooks.onError = vi.fn().mockImplementation(async () => {
      fixture.stop();
    });
    const observedAttempts = vi.fn();
    try {
      const result = await createLlmReasonNode({
        dispatcher: hooks,
        onModelAttempt: observedAttempts,
      })(state(), fixture.config);
      expect(result.halted).toBe(true);
      expect(requests).toEqual(['/v1/chat/completions']);
      expect(observedAttempts).toHaveBeenCalledTimes(1);
      expect(fixture.admitted).toEqual(['model']);
      expect(result.trace).toContainEqual({ type: 'stream_aborted', reason: 'user_stop' });
    } finally {
      vi.unstubAllEnvs();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('preserves actual partial streamed text on user Stop and emits no next provider request', async () => {
    const fixture = controlFixture();
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(request.url ?? '');
      request.resume();
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(
        'data: ' +
          JSON.stringify({
            id: 'fixture',
            object: 'chat.completion.chunk',
            created: 1,
            model: 'fixture',
            choices: [
              {
                index: 0,
                delta: { role: 'assistant', content: 'Retained partial reply' },
                finish_reason: null,
              },
            ],
          }) +
          '\n\n',
      );
      // Kept open until the harness aborts; no timers, mock SDK or external provider.
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('fixture unavailable');
    vi.stubEnv('OLLAMA_BASE_URL', `http://127.0.0.1:${address.port}/v1`);
    try {
      const result = await createLlmReasonNode({
        emitter: {
          emit(event) {
            if (event.type === 'text') fixture.stop();
          },
          end() {},
        },
      })(state(), fixture.config);
      expect(result.halted).toBe(true);
      expect(result.messages).toEqual([{ role: 'assistant', content: 'Retained partial reply' }]);
      expect(result.llmOutput).toBeNull();
      expect(requests).toEqual(['/v1/chat/completions']);
      expect(fixture.pending.size).toBe(0);
      expect(result.trace).toContainEqual({ type: 'stream_aborted', reason: 'user_stop' });
    } finally {
      vi.unstubAllEnvs();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
