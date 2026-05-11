import { DefaultSlashCommandParser, type SlashCommandParser } from './parser.js';
import type { RunSlashCommandResult, SlashCommandContext, SlashCommandRegistry } from './types.js';

export type RunSlashCommandOptions = {
  parser?: SlashCommandParser;
  registry: SlashCommandRegistry;
};

export type RunSlashCommandContext = Omit<SlashCommandContext, 'commands'>;

const defaultParser = new DefaultSlashCommandParser();

export function runSlashCommand(
  message: string,
  context: RunSlashCommandContext,
  options: RunSlashCommandOptions,
): RunSlashCommandResult {
  const parser = options.parser ?? defaultParser;
  const { registry } = options;
  const parsed = parser.parse(message);
  if (parsed.kind === 'not_command') return { kind: 'not_command' };

  const command = registry.find(parsed.invocation.name);
  if (!command) {
    const commands = registry
      .list()
      .map((item) => `/${item.name}`)
      .sort((left, right) => left.localeCompare(right))
      .join(', ');
    return {
      kind: 'handled',
      status: 'unknown_command',
      message: commands
        ? `Command not recognised. Available commands: ${commands}. Run /help for details.`
        : 'Command not recognised.',
    };
  }

  const result = command.execute({ ...context, commands: registry }, parsed.invocation);
  return {
    kind: 'handled',
    status: result.kind,
    message: result.message,
  };
}
