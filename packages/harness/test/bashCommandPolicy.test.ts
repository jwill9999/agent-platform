import { describe, expect, it } from 'vitest';

import { classifyBashCommand } from '../src/security/bashCommandPolicy.js';

describe('bash command policy', () => {
  it('allows safe read-only inspection commands', () => {
    expect(classifyBashCommand('rg "needle" docs')).toMatchObject({
      state: 'allowed',
      category: 'read_only',
    });
    expect(classifyBashCommand('git status --short')).toMatchObject({
      state: 'allowed',
      category: 'read_only',
    });
    expect(classifyBashCommand('sed -n "1,20p" package.json')).toMatchObject({
      state: 'allowed',
      category: 'read_only',
    });
  });

  it('approval-gates writes, redirects, shell chaining, and package scripts', () => {
    for (const command of [
      'touch notes.md',
      'mkdir -p generated',
      'cp README.md generated/README.md',
      'cat README.md > generated/README.md',
      'git status && git diff',
      'pnpm test',
      'npm run build',
    ]) {
      expect(classifyBashCommand(command)).toMatchObject({
        state: 'approval_required',
      });
    }
  });

  it('blocks destructive removals and host-level mutations', () => {
    for (const command of [
      'rm -rf generated',
      'rm -r generated',
      'chmod 777 script.sh',
      'chown root script.sh',
      'dd if=/dev/zero of=image.bin',
      'sudo make install',
    ]) {
      expect(classifyBashCommand(command)).toMatchObject({
        state: 'denied',
      });
    }
  });
});
