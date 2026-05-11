import type { SlashCommandDefinition, SlashCommandRegistry } from './types.js';
import { StaticSlashCommandRegistry } from './registry.js';

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
    if (!context.project || !context.session.projectId) {
      return {
        kind: 'missing_context',
        message: 'Open a Project first, then run /init to set up Project instructions.',
      };
    }

    const project = context.startProjectOnboarding(context.session.projectId);
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
  return new StaticSlashCommandRegistry([initSlashCommand]);
}
