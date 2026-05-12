import type { RiskTier } from '@agent-platform/contracts';

export type BashCommandPolicyDecision =
  | { state: 'allowed'; category: 'read_only'; reason: string }
  | {
      state: 'approval_required';
      category: 'write' | 'script' | 'chain';
      riskTier: RiskTier;
      reason: string;
      code: string;
    }
  | { state: 'denied'; category: 'destructive'; reason: string; code: string };

const READ_ONLY_COMMANDS = new Set([
  'pwd',
  'ls',
  'find',
  'rg',
  'grep',
  'egrep',
  'fgrep',
  'cat',
  'head',
  'tail',
  'wc',
  'stat',
  'du',
  'file',
  'diff',
  'realpath',
  'readlink',
  'sort',
  'uniq',
  'cut',
  'jq',
  'awk',
  'echo',
  'printf',
  'date',
  'env',
  'printenv',
  'uname',
  'which',
  'whoami',
]);

const READ_ONLY_GIT_SUBCOMMANDS = new Set(['status', 'diff', 'log', 'branch', 'show', 'rev-parse']);
const WRITE_COMMANDS = new Set(['touch', 'mkdir', 'cp', 'mv', 'ln', 'tee']);
const PACKAGE_OR_SCRIPT_COMMANDS = new Set([
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'node',
  'tsx',
  'tsc',
  'make',
]);
const DESTRUCTIVE_COMMANDS = new Set([
  'chmod',
  'chown',
  'chgrp',
  'sudo',
  'su',
  'doas',
  'dd',
  'mkfs',
  'fdisk',
  'mount',
  'umount',
  'systemctl',
  'service',
  'crontab',
]);

const SHELL_CHAIN_PATTERN = /(?:^|[^\\])(?:&&|\|\||;|\|&|\|)/;
const SHELL_REDIRECT_PATTERN = /(?:^|[^\\])(?:>>?|&>|>\|)/;

function shellTokens(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

function commandName(raw: string | undefined): string {
  if (!raw) return '';
  const lastSlash = raw.lastIndexOf('/');
  return lastSlash >= 0 ? raw.slice(lastSlash + 1) : raw;
}

function hasRecursiveRemoval(command: string): boolean {
  return /\brm\s+(?:(?:-[^\s]*r[^\s]*)|(?:-[^\s]*R[^\s]*)|(?:--recursive\b))/.test(command);
}

function readOnlyDecision(): BashCommandPolicyDecision {
  return {
    state: 'allowed',
    category: 'read_only',
    reason: 'Read-only Project inspection command.',
  };
}

function approvalDecision(
  category: 'write' | 'script' | 'chain',
  code: string,
  reason: string,
): BashCommandPolicyDecision {
  return {
    state: 'approval_required',
    category,
    code,
    riskTier: 'high',
    reason,
  };
}

function deniedDecision(code: string, reason: string): BashCommandPolicyDecision {
  return {
    state: 'denied',
    category: 'destructive',
    code,
    reason,
  };
}

export function classifyBashCommand(command: string): BashCommandPolicyDecision {
  const trimmed = command.trim();
  const [rawCommand, subcommand] = shellTokens(trimmed);
  const name = commandName(rawCommand);

  if (!trimmed || !name) {
    return deniedDecision('empty_command', 'Empty shell commands are not allowed.');
  }

  if (hasRecursiveRemoval(trimmed)) {
    return deniedDecision(
      'recursive_removal',
      'Recursive removal commands are blocked. Delete files through a reviewed file operation instead.',
    );
  }

  if (DESTRUCTIVE_COMMANDS.has(name)) {
    return deniedDecision(
      'host_mutation',
      `Command "${name}" can mutate host permissions, disks, services, or users and is blocked.`,
    );
  }

  if (SHELL_CHAIN_PATTERN.test(trimmed)) {
    return approvalDecision(
      'chain',
      'shell_chaining',
      'Shell chaining or pipelines require human approval before execution.',
    );
  }

  if (SHELL_REDIRECT_PATTERN.test(trimmed)) {
    return approvalDecision(
      'write',
      'shell_redirection',
      'Shell redirection can write files and requires human approval before execution.',
    );
  }

  if (name === 'git') {
    return subcommand && READ_ONLY_GIT_SUBCOMMANDS.has(subcommand)
      ? readOnlyDecision()
      : approvalDecision(
          'write',
          'git_mutation',
          'Git commands that are not read-only require human approval before execution.',
        );
  }

  if (name === 'sed') {
    return subcommand === '-n'
      ? readOnlyDecision()
      : approvalDecision(
          'write',
          'sed_mutation',
          'sed commands that may edit files require human approval before execution.',
        );
  }

  if (WRITE_COMMANDS.has(name)) {
    return approvalDecision(
      'write',
      'write_command',
      `Command "${name}" can write files and requires human approval before execution.`,
    );
  }

  if (PACKAGE_OR_SCRIPT_COMMANDS.has(name)) {
    return approvalDecision(
      'script',
      'package_or_script_execution',
      `Command "${name}" can run project scripts and requires human approval before execution.`,
    );
  }

  if (READ_ONLY_COMMANDS.has(name)) return readOnlyDecision();

  return approvalDecision(
    'script',
    'unknown_command_effect',
    `Command "${name}" is not classified as read-only and requires human approval before execution.`,
  );
}
