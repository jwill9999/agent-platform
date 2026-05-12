import type { SlashCommandDefinition, SlashCommandRegistry } from './types.js';
import { StaticSlashCommandRegistry } from './registry.js';

export const helpSlashCommand: SlashCommandDefinition = {
  name: 'help',
  summary: 'Show available slash commands.',
  usage: '/help [command]',
  scope: 'session',
  sideEffects: false,
  execute(context, invocation) {
    if (!invocation.args) {
      const commands = context.commands
        .list()
        .map((command) => `/${command.name} - ${command.summary}`)
        .sort((left, right) => left.localeCompare(right));
      return {
        kind: 'handled',
        message: commands.length
          ? `Available slash commands:\n${commands.join('\n')}`
          : 'No slash commands are available.',
      };
    }

    const requestedCommand = invocation.args.trim();
    const commandName = (
      requestedCommand.startsWith('/') ? requestedCommand.slice(1) : requestedCommand
    ).toLowerCase();
    if (!commandName || commandName.includes(' ')) {
      return {
        kind: 'invalid_usage',
        message: 'Usage: /help [command]',
      };
    }

    const command = context.commands.find(commandName);
    if (!command) {
      return {
        kind: 'handled',
        message: `Command /${commandName} is not available. Run /help to see available commands.`,
      };
    }

    const aliasList = command.aliases?.map((alias) => `/${alias}`).join(', ') ?? '';
    const aliases = aliasList ? `\nAliases: ${aliasList}` : '';
    const effect = command.sideEffects ? 'May change Project state.' : 'Does not change state.';
    return {
      kind: 'handled',
      message: `/${command.name} - ${command.summary}\nUsage: ${command.usage}\nScope: ${command.scope}\n${effect}${aliases}`,
    };
  },
};

export const initSlashCommand: SlashCommandDefinition = {
  name: 'init',
  summary: 'Set up Project instructions for the selected Project.',
  usage: '/init',
  scope: 'project',
  sideEffects: true,
  execute(context, invocation) {
    if (invocation.args) {
      return {
        kind: 'invalid_usage',
        message: 'Usage: /init',
      };
    }
    if (!context.project || !context.projectId) {
      return {
        kind: 'missing_context',
        message: 'Open a Project with Open Project, then run /init to set up Project instructions.',
      };
    }

    const project = context.startProjectOnboarding(context.projectId);
    const draft = project.metadata['onboardingDraft'];
    const state = project.metadata['onboardingState'];

    if (state === 'approved') {
      return {
        kind: 'handled',
        message:
          'Project instructions are already approved. You can continue working in this Project.',
      };
    }

    if (draft) {
      return {
        kind: 'handled',
        message:
          'I started Project setup and prepared a Project instructions draft. Review the draft, then approve it when you are ready to enable file edits.',
      };
    }

    return {
      kind: 'handled',
      message:
        'I started Project setup. Review the Project setup panel for the next question or draft before enabling file edits.',
    };
  },
};

export function createBuiltinSlashCommandRegistry(): SlashCommandRegistry {
  return new StaticSlashCommandRegistry([helpSlashCommand, initSlashCommand]);
}
