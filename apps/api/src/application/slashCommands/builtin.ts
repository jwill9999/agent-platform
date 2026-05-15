import { ProjectOnboardingDraftSchema } from '@agent-platform/contracts';

import type {
  SlashCommandDefinition,
  SlashCommandMetadata,
  SlashCommandRegistry,
  SlashCommandScope,
} from './types.js';
import { StaticSlashCommandRegistry } from './registry.js';

function formatInitDraftMessage(draft: unknown): string {
  const parsed = ProjectOnboardingDraftSchema.safeParse(draft);
  if (!parsed.success) {
    return 'I started Project setup. Review the Project instructions draft in Project Chat, then approve it when you are ready to enable file edits.';
  }

  return [
    `I prepared a Project instructions draft for ${parsed.data.targetPath}.`,
    '',
    'Review the draft shown in Project Chat, then approve it when you are ready to enable file edits.',
  ].join('\n');
}

function formatCommandScope(scope: SlashCommandScope): string {
  return scope === 'project' ? 'Selected Project' : 'Current chat';
}

function formatCommandStateEffect(command: SlashCommandMetadata): string {
  return command.sideEffects ? 'May update Project setup.' : 'Does not change Project state.';
}

function formatCommandHelpEntry(command: SlashCommandMetadata): string {
  return [
    `- **/${command.name}** - ${command.summary}`,
    `  - Usage: \`${command.usage}\``,
    `  - Scope: ${formatCommandScope(command.scope)}`,
    `  - State: ${formatCommandStateEffect(command)}`,
  ].join('\n');
}

export function formatAvailableSlashCommandHelp(commands: readonly SlashCommandMetadata[]): string {
  const entries = [...commands]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(formatCommandHelpEntry);

  if (entries.length === 0) return 'No slash commands are available.';

  return ['Available slash commands:', '', ...entries].join('\n');
}

export function formatFocusedSlashCommandHelp(command: SlashCommandMetadata): string {
  const aliasList = command.aliases?.map((alias) => `\`/${alias}\``).join(', ');
  return [
    `### /${command.name}`,
    '',
    command.summary,
    '',
    `- Usage: \`${command.usage}\``,
    `- Scope: ${formatCommandScope(command.scope)}`,
    `- State: ${formatCommandStateEffect(command)}`,
    ...(aliasList ? [`- Aliases: ${aliasList}`] : []),
  ].join('\n');
}

export const helpSlashCommand: SlashCommandDefinition = {
  name: 'help',
  summary: 'Show available slash commands.',
  usage: '/help [command]',
  scope: 'session',
  sideEffects: false,
  execute(context, invocation) {
    if (!invocation.args) {
      return {
        kind: 'handled',
        message: formatAvailableSlashCommandHelp(context.commands.list()),
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

    return {
      kind: 'handled',
      message: formatFocusedSlashCommandHelp(command),
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
        message: formatInitDraftMessage(draft),
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
