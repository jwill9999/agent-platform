import { DefaultSlashCommandParser, type SlashCommandParser } from './parser.js';
import { createBuiltinSlashCommandRegistry } from './builtin.js';
import type { RunSlashCommandResult, SlashCommandContext, SlashCommandRegistry } from './types.js';

export type RunSlashCommandOptions = {
  parser?: SlashCommandParser;
  registry?: SlashCommandRegistry;
};

export function runSlashCommand(
  message: string,
  context: SlashCommandContext,
  options: RunSlashCommandOptions = {},
): RunSlashCommandResult {
  const parser = options.parser ?? new DefaultSlashCommandParser();
  const registry = options.registry ?? createBuiltinSlashCommandRegistry();
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
        ? `Command not recognised. Available commands: ${commands}.`
        : 'Command not recognised.',
    };
  }

  const result = command.execute(context, parsed.invocation);
  return {
    kind: 'handled',
    status: result.kind,
    message: result.message,
  };
}
