export type SlashCommandInvocation = {
  raw: string;
  name: string;
  token: string;
  args: string;
};

export type SlashCommandParseResult =
  | { kind: 'not_command' }
  | { kind: 'command'; invocation: SlashCommandInvocation };

export interface SlashCommandParser {
  parse(message: string): SlashCommandParseResult;
}

export class DefaultSlashCommandParser implements SlashCommandParser {
  parse(message: string): SlashCommandParseResult {
    const raw = message.trim();
    if (!raw.startsWith('/')) return { kind: 'not_command' };

    const body = raw.slice(1);
    const tokenEnd = firstWhitespaceIndex(body);
    const commandName = body.slice(0, tokenEnd);
    if (!isCommandName(commandName)) {
      return {
        kind: 'command',
        invocation: {
          raw,
          name: '',
          token: tokenEnd === body.length ? raw : raw.slice(0, tokenEnd + 1),
          args: '',
        },
      };
    }

    const name = commandName.toLowerCase();
    return {
      kind: 'command',
      invocation: {
        raw,
        name,
        token: `/${name}`,
        args: body.slice(tokenEnd).trim(),
      },
    };
  }
}

function firstWhitespaceIndex(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    if (isWhitespace(value.codePointAt(index) ?? 0)) return index;
  }
  return value.length;
}

function isCommandName(value: string): boolean {
  if (!value) return false;
  const first = value.codePointAt(0) ?? 0;
  if (!isAsciiLetter(first)) return false;
  for (let index = 1; index < value.length; index += 1) {
    const code = value.codePointAt(index) ?? 0;
    if (!isAsciiLetter(code) && !isAsciiDigit(code) && code !== 45 && code !== 95) {
      return false;
    }
  }
  return true;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

function isWhitespace(code: number): boolean {
  return code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32;
}
