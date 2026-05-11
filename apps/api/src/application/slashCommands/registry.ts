import type {
  SlashCommandDefinition,
  SlashCommandMetadata,
  SlashCommandRegistry,
} from './types.js';

export class StaticSlashCommandRegistry implements SlashCommandRegistry {
  private readonly commandsByName = new Map<string, SlashCommandDefinition>();

  constructor(commands: readonly SlashCommandDefinition[]) {
    for (const command of commands) {
      this.commandsByName.set(normalise(command.name), command);
      for (const alias of command.aliases ?? []) {
        this.commandsByName.set(normalise(alias), command);
      }
    }
  }

  list(): readonly SlashCommandMetadata[] {
    const seen = new Set<string>();
    const commands: SlashCommandMetadata[] = [];
    for (const command of this.commandsByName.values()) {
      if (seen.has(command.name)) continue;
      seen.add(command.name);
      commands.push({
        name: command.name,
        aliases: command.aliases,
        summary: command.summary,
        usage: command.usage,
        scope: command.scope,
        sideEffects: command.sideEffects,
      });
    }
    return commands;
  }

  find(name: string): SlashCommandDefinition | undefined {
    return this.commandsByName.get(normalise(name));
  }
}

function normalise(name: string): string {
  return name.replace(/^\//, '').toLowerCase();
}
