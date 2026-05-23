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
    expect(classifyBashCommand('touch notes.md')).toMatchObject({
      state: 'approval_required',
      category: 'workspace_write',
    });
    expect(classifyBashCommand('cat README.md > generated/README.md')).toMatchObject({
      state: 'approval_required',
      category: 'workspace_write',
    });
    expect(classifyBashCommand('git status && git diff')).toMatchObject({
      state: 'approval_required',
      category: 'unknown',
    });
    expect(classifyBashCommand('pnpm test')).toMatchObject({
      state: 'approval_required',
      category: 'package_install',
    });
    expect(classifyBashCommand('git push')).toMatchObject({
      state: 'approval_required',
      category: 'git_mutation',
    });
    expect(classifyBashCommand('curl https://api.example.com')).toMatchObject({
      state: 'approval_required',
      category: 'network',
    });
    expect(classifyBashCommand('docker compose up')).toMatchObject({
      state: 'approval_required',
      category: 'container',
    });
    expect(classifyBashCommand('gh repo create test --private')).toMatchObject({
      state: 'approval_required',
      category: 'unknown',
    });
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
