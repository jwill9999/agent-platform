import { basename } from 'node:path';
import type { PathJail, PathOperation } from './pathJail.js';

export type BashPathAccess = {
  path: string;
  operation: PathOperation;
};

export type BashWorkspacePolicyResult =
  | { allowed: true; accesses: BashPathAccess[] }
  | { allowed: false; reason: string; path: string };

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
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let idx = 0; idx < segment.length; idx++) {
    const char = segment[idx]!;

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (isWhitespace(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

function splitShellSegments(command: string): string[] {
  const segments: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let idx = 0; idx < command.length; idx++) {
    const char = command[idx]!;

    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === ';' || char === '|') {
      if (current.trim()) segments.push(current);
      current = '';
      if (command[idx + 1] === '|' || command[idx + 1] === '&') idx++;
      continue;
    }

    if (char === '&' && command[idx + 1] === '&') {
      if (current.trim()) segments.push(current);
      current = '';
      idx++;
      continue;
    }

    current += char;
  }

  if (current.trim()) segments.push(current);
  return segments;
}

function commandName(raw: string): string {
  return basename(raw);
}

function isOption(token: string): boolean {
  return token.startsWith('-') && token !== '-';
}

function isAssignment(token: string): boolean {
  const equalsIdx = token.indexOf('=');
  if (equalsIdx <= 0) return false;

  const first = token.charCodeAt(0);
  if (!isAsciiLetter(first) && first !== 95) return false;

  for (let idx = 1; idx < equalsIdx; idx++) {
    const code = token.charCodeAt(idx);
    if (!isAsciiLetter(code) && !isAsciiDigit(code) && code !== 95) return false;
  }

  return true;
}

function isPathOperand(token: string): boolean {
  if (!token || token.startsWith('$')) return false;
  if (token === '.' || token === '..') return true;
  if (token.startsWith('/') || token.startsWith('./') || token.startsWith('../')) return true;
  return token.includes('/');
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function redirectTargetFromToken(token: string): string | null {
  if (token === '>' || token === '>>' || token === '&>' || token === '>|') return '';
  if (token.startsWith('>>')) return token.slice(2);
  if (token.startsWith('&>') || token.startsWith('>|')) return token.slice(2);
  if (token.startsWith('>')) return token.slice(1);

  const redirectIdx = token.indexOf('>');
  if (redirectIdx <= 0) return null;
  for (let idx = 0; idx < redirectIdx; idx++) {
    if (!isAsciiDigit(token.charCodeAt(idx))) return null;
  }
  return token.slice(redirectIdx + 1);
}

function collectRedirectWrites(tokens: string[]): BashPathAccess[] {
  const accesses: BashPathAccess[] = [];
  for (let idx = 0; idx < tokens.length; idx++) {
    const target = redirectTargetFromToken(tokens[idx]!);
    if (target === null) continue;

    const path = target || tokens[idx + 1];
    if (path) accesses.push({ path, operation: 'write' });
  }
  return accesses;
}

function removeRedirects(tokens: string[]): string[] {
  const kept: string[] = [];

  for (let idx = 0; idx < tokens.length; idx++) {
    const target = redirectTargetFromToken(tokens[idx]!);
    if (target === null) {
      kept.push(tokens[idx]!);
      continue;
    }

    if (!target) idx++;
  }

  return kept;
}

function collectSegmentAccesses(segment: string): BashPathAccess[] {
  const rawTokens = tokenize(segment);
  const tokens = removeRedirects(rawTokens);
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
  const accesses: BashPathAccess[] = [];
  for (const segment of splitShellSegments(command)) {
    accesses.push(...collectRedirectWrites(tokenize(segment)));
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
