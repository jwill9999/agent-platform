import { basename } from 'node:path';
import type { PathJail, PathOperation } from './pathJail.js';

export type BashPathAccess = {
  path: string;
  operation: PathOperation;
};

export type BashWorkspacePolicyResult =
  | { allowed: true; accesses: BashPathAccess[] }
  | { allowed: false; reason: string; path: string };

const SHELL_SEPARATORS = /\s*(?:\|\||\|&|\||&&|;)\s*/;
const WRITE_REDIRECT_PATTERN = /(?:^|\s)(?:\d?>|>>|&>|>\|)\s*(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g;

const READ_COMMANDS = new Set([
  'cat',
  'head',
  'tail',
  'wc',
  'stat',
  'du',
  'file',
  'less',
  'more',
  'diff',
  'realpath',
  'readlink',
  'grep',
  'egrep',
  'fgrep',
  'find',
  'sed',
  'awk',
]);

const WRITE_ALL_OPERAND_COMMANDS = new Set(['touch', 'mkdir', 'tee']);
const READ_THEN_WRITE_LAST_COMMANDS = new Set(['cp', 'mv', 'ln']);

function tokenize(segment: string): string[] {
  const matches = segment.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\S+/g) ?? [];
  return matches.map((token) => {
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1);
    }
    return token;
  });
}

function commandName(raw: string): string {
  return basename(raw);
}

function isOption(token: string): boolean {
  return token.startsWith('-') && token !== '-';
}

function isAssignment(token: string): boolean {
  return /^[A-Za-z_]\w*=/.test(token);
}

function isPathOperand(token: string): boolean {
  if (!token || token.startsWith('$')) return false;
  if (token === '.' || token === '..') return true;
  if (token.startsWith('/') || token.startsWith('./') || token.startsWith('../')) return true;
  return token.includes('/');
}

function stripRedirections(segment: string): string {
  return segment.replace(WRITE_REDIRECT_PATTERN, ' ');
}

function collectRedirectWrites(command: string): BashPathAccess[] {
  const accesses: BashPathAccess[] = [];
  for (const match of command.matchAll(WRITE_REDIRECT_PATTERN)) {
    const path = match[1] ?? match[2] ?? match[3];
    if (path) accesses.push({ path, operation: 'write' });
  }
  return accesses;
}

function collectSegmentAccesses(segment: string): BashPathAccess[] {
  const tokens = tokenize(stripRedirections(segment));
  let idx = 0;

  while (idx < tokens.length && (isAssignment(tokens[idx]!) || tokens[idx] === 'env')) {
    idx++;
  }

  const cmd = tokens[idx] ? commandName(tokens[idx]!) : '';
  if (!cmd) return [];

  const operands = tokens
    .slice(idx + 1)
    .filter((token) => !isOption(token) && isPathOperand(token));

  if (WRITE_ALL_OPERAND_COMMANDS.has(cmd)) {
    return operands.map((path) => ({ path, operation: 'write' }));
  }

  if (READ_THEN_WRITE_LAST_COMMANDS.has(cmd)) {
    return operands.map((path, operandIdx) => ({
      path,
      operation: operandIdx === operands.length - 1 ? 'write' : 'read',
    }));
  }

  if (READ_COMMANDS.has(cmd)) {
    return operands.map((path) => ({ path, operation: 'read' }));
  }

  return [];
}

export function extractBashPathAccesses(command: string): BashPathAccess[] {
  const accesses = collectRedirectWrites(command);
  for (const segment of command.split(SHELL_SEPARATORS).filter(Boolean)) {
    accesses.push(...collectSegmentAccesses(segment));
  }
  return accesses;
}

export async function validateBashWorkspacePolicy(
  command: string,
  pathJail: PathJail,
): Promise<BashWorkspacePolicyResult> {
  const accesses = extractBashPathAccesses(command);
  for (const access of accesses) {
    const result = await pathJail.validate(access.path, access.operation);
    if (!result.allowed) {
      return {
        allowed: false,
        path: access.path,
        reason:
          result.reason ??
          `Path "${access.path}" is outside the approved workspace for ${access.operation}`,
      };
    }
  }

  return { allowed: true, accesses };
}
