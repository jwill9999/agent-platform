import { describe, expect, it } from 'vitest';

import {
  commandRunnerStatusDescription,
  commandRunnerStatusLabel,
} from '../lib/project-navigation';
import { projectTerminalLocationLabel } from '../components/project/project-terminal-dock';

describe('Project surface labels', () => {
  it('translates command readiness without exposing runtime modes or messages', () => {
    const ready = {
      canExecute: true,
      message: 'macos-vm ready at /workspace',
      mode: 'macos-vm',
      reason: '',
      status: 'ready',
    };
    const unavailable = {
      ...ready,
      canExecute: false,
      message: 'backend command runner failed',
      status: 'failed',
    };

    expect(commandRunnerStatusLabel(ready)).toBe('Commands ready');
    expect(commandRunnerStatusDescription(ready)).toBe('Project commands are ready.');
    expect(commandRunnerStatusLabel(unavailable)).toBe('Commands unavailable');
    expect(commandRunnerStatusDescription(unavailable)).toBe('Project commands are unavailable.');
  });

  it('replaces an absolute terminal cwd with Project-relative location copy', () => {
    expect(projectTerminalLocationLabel('/Users/example/private-project')).toBe('Project root');
    expect(projectTerminalLocationLabel('/workspace')).toBe('Project root');
    expect(projectTerminalLocationLabel(undefined)).toBe(null);
  });
});
