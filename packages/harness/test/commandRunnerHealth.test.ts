import { describe, expect, it, vi } from 'vitest';

import {
  getConfiguredCommandRunnerHealth,
  type CommandRunner,
  type CommandRunnerHealth,
} from '../src/index.js';

const macosVmRunner: CommandRunner = {
  run: vi.fn(),
};

describe('CommandRunner health contract', () => {
  it('reports disabled mode as non-executable and non-production', () => {
    expect(getConfiguredCommandRunnerHealth({ env: {} })).toEqual({
      mode: 'disabled',
      status: 'disabled',
      production: false,
      canExecute: false,
      reason: 'command_runner_disabled',
      message: 'Command execution is disabled because no production runner is configured.',
    } satisfies CommandRunnerHealth);
  });

  it('reports host mode as executable development-only mode', () => {
    expect(
      getConfiguredCommandRunnerHealth({ env: { AGENT_PLATFORM_COMMAND_RUNNER: 'host' } }),
    ).toEqual({
      mode: 'host',
      status: 'ready',
      production: false,
      canExecute: true,
      reason: 'development_only',
      message: 'Host command execution is available for explicit local development only.',
    } satisfies CommandRunnerHealth);
  });

  it('reports Docker sandbox mode as executable development-only mode', () => {
    expect(
      getConfiguredCommandRunnerHealth({
        env: { AGENT_PLATFORM_COMMAND_RUNNER: 'docker-sandbox' },
      }),
    ).toEqual({
      mode: 'docker-sandbox',
      status: 'ready',
      production: false,
      canExecute: true,
      reason: 'development_only',
      message: 'Docker sandbox execution is available for development and adapter testing only.',
    } satisfies CommandRunnerHealth);
  });

  it('reports macOS VM mode as unavailable until a runner is configured', () => {
    expect(
      getConfiguredCommandRunnerHealth({
        env: { AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm' },
      }),
    ).toEqual({
      mode: 'macos-vm',
      status: 'unavailable',
      production: true,
      canExecute: false,
      reason: 'macos_vm_runner_unavailable',
      message: 'macOS VM command execution is selected but no VM runner is configured.',
    } satisfies CommandRunnerHealth);
  });

  it('reports macOS VM mode as production-ready when a runner is configured', () => {
    expect(
      getConfiguredCommandRunnerHealth({
        env: { AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm' },
        macosVmRunner,
      }),
    ).toEqual({
      mode: 'macos-vm',
      status: 'ready',
      production: true,
      canExecute: true,
      reason: 'production_runner_ready',
      message: 'macOS VM command execution is configured.',
    } satisfies CommandRunnerHealth);
  });
});
