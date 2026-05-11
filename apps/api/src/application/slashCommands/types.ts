import type { ProjectRecord, SessionRecord } from '@agent-platform/contracts';

import type { SlashCommandInvocation } from './parser.js';

export type SlashCommandScope = 'session' | 'project';

export type SlashCommandMetadata = {
  name: string;
  aliases?: readonly string[];
  summary: string;
  usage: string;
  scope: SlashCommandScope;
  sideEffects: boolean;
};

export type SlashCommandResult =
  | {
      kind: 'handled';
      message: string;
    }
  | {
      kind: 'missing_context';
      message: string;
    }
  | {
      kind: 'invalid_usage';
      message: string;
    };

export type SlashCommandContext = {
  session: SessionRecord;
  project?: ProjectRecord;
  startProjectOnboarding(projectId: string): ProjectRecord;
};

export type SlashCommandDefinition = SlashCommandMetadata & {
  execute(context: SlashCommandContext, invocation: SlashCommandInvocation): SlashCommandResult;
};

export interface SlashCommandRegistry {
  list(): readonly SlashCommandMetadata[];
  find(name: string): SlashCommandDefinition | undefined;
}

export type RunSlashCommandResult =
  | { kind: 'not_command' }
  | { kind: 'handled'; status: SlashCommandResult['kind'] | 'unknown_command'; message: string };
