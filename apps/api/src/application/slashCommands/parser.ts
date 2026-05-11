export type SlashCommandInvocation = {
  raw: string;
  name: string;
  token: string;
  args: string;
};

export type SlashCommandParseResult =
  | { kind: 'not_command' }
  | { kind: 'command'; invocation: SlashCommandInvocation };

const COMMAND_TOKEN = /^\/([A-Za-z][A-Za-z0-9_-]*)(?:\s+([\s\S]*))?$/;

export interface SlashCommandParser {
  parse(message: string): SlashCommandParseResult;
}

export class DefaultSlashCommandParser implements SlashCommandParser {
  parse(message: string): SlashCommandParseResult {
    const raw = message.trim();
    if (!raw.startsWith('/')) return { kind: 'not_command' };

    const match = COMMAND_TOKEN.exec(raw);
    if (!match?.[1]) {
      return {
        kind: 'command',
        invocation: {
          raw,
          name: '',
          token: raw.split(/\s+/, 1)[0] ?? raw,
          args: '',
        },
      };
    }

    const name = match[1].toLowerCase();
    return {
      kind: 'command',
      invocation: {
        raw,
        name,
        token: `/${name}`,
        args: match[2]?.trim() ?? '',
      },
    };
  }
}
