import { createHash } from 'node:crypto';

import type { SpecialistProcessExecutor } from '../src/specialistLauncher.js';

/** Stateful Docker protocol fixture only. It never supplies production transport provenance. */
export function schedulerDockerFixture(delegate: SpecialistProcessExecutor) {
  const calls: string[][] = [];
  const containers = new Map<
    string,
    { id: string; name: string; owner: string; running: boolean }
  >();
  const register = (executionId: string) => {
    const name = `workflow-specialist-${executionId}`;
    const id = createHash('sha256').update(name).digest('hex');
    containers.set(id, { id, name: `/${name}`, owner: executionId, running: false });
    return id;
  };
  const executor: SpecialistProcessExecutor = async (binary, inputArgs, options) => {
    if (binary !== '/usr/local/bin/docker') return delegate(binary, inputArgs, options);
    const args = inputArgs[0] === 'container' ? inputArgs.slice(1) : inputArgs;
    calls.push([...args]);
    if (args[0] === 'create') {
      const name = args[args.indexOf('--name') + 1];
      if (!name?.startsWith('workflow-specialist-')) throw new Error('fixture lacks owned name');
      const owner = name.slice('workflow-specialist-'.length);
      if (!args.includes(`io.agent-platform.specialist-execution=${owner}`))
        throw new Error('fixture lacks owned label');
      await delegate(binary, args, options);
      return { stdout: `${register(owner)}\n`, stderr: '' };
    }
    const identity = args.at(-1)!;
    const container =
      containers.get(identity) ??
      [...containers.values()].find((item) => item.name === `/${identity}`);
    if (args[0] === 'inspect') {
      if (container === undefined)
        throw Object.assign(new Error('fixture container absent'), {
          code: 1,
          stderr: `Error response from daemon: No such container: ${identity}`,
        });
      return {
        stdout: JSON.stringify({
          ...container,
          status: container.running ? 'running' : 'exited',
          exitCode: 0,
        }),
        stderr: '',
      };
    }
    if (args[0] === 'start' && container !== undefined) container.running = true;
    const result = await delegate(binary, args, options);
    if ((args[0] === 'start' || args[0] === 'stop') && container !== undefined)
      container.running = false;
    if (args[0] === 'rm' && container !== undefined) containers.delete(container.id);
    return result;
  };
  return { executor, register, calls };
}
