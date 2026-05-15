import { describe, expect, it } from 'vitest';

import {
  createBuiltinSlashCommandRegistry,
  helpSlashCommand,
} from '../src/application/slashCommands/builtin.js';
import { DefaultSlashCommandParser } from '../src/application/slashCommands/parser.js';
import { StaticSlashCommandRegistry } from '../src/application/slashCommands/registry.js';
import { runSlashCommand } from '../src/application/slashCommands/runSlashCommand.js';
import type { SlashCommandDefinition } from '../src/application/slashCommands/types.js';

const CUSTOM_HELP_TEXT = [
  'Available slash commands:',
  '',
  '- **/echo** - Echo a value.',
  '  - Usage: `/echo <value>`',
  '  - Scope: Current chat',
  '  - State: Does not change Project state.',
  '- **/help** - Show available slash commands.',
  '  - Usage: `/help [command]`',
  '  - Scope: Current chat',
  '  - State: Does not change Project state.',
].join('\n');

const BUILTIN_HELP_TEXT = [
  'Available slash commands:',
  '',
  '- **/help** - Show available slash commands.',
  '  - Usage: `/help [command]`',
  '  - Scope: Current chat',
  '  - State: Does not change Project state.',
  '- **/init** - Set up Project instructions for the selected Project.',
  '  - Usage: `/init`',
  '  - Scope: Selected Project',
  '  - State: May update Project setup.',
].join('\n');

const ECHO_HELP_TEXT = [
  '### /echo',
  '',
  'Echo a value.',
  '',
  '- Usage: `/echo <value>`',
  '- Scope: Current chat',
  '- State: Does not change Project state.',
  '- Aliases: `/say`',
].join('\n');

const INIT_HELP_TEXT = [
  '### /init',
  '',
  'Set up Project instructions for the selected Project.',
  '',
  '- Usage: `/init`',
  '- Scope: Selected Project',
  '- State: May update Project setup.',
].join('\n');

const session = {
  id: 'session-1',
  agentId: 'agent-1',
  mode: 'chat' as const,
  title: null,
  projectId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const project = {
  id: 'project-1',
  slug: 'project-1',
  name: 'Project One',
  workspacePath: '/workspace',
  metadata: {},
  createdAtMs: 1,
  updatedAtMs: 1,
};

describe('slash command parser', () => {
  const parser = new DefaultSlashCommandParser();

  it('parses a command token and arguments', () => {
    expect(parser.parse('/init extra words')).toEqual({
      kind: 'command',
      invocation: {
        raw: '/init extra words',
        name: 'init',
        token: '/init',
        args: 'extra words',
      },
    });
  });

  it('allows surrounding whitespace but does not parse inline slash text as a command', () => {
    expect(parser.parse('  /init  ')).toMatchObject({
      kind: 'command',
      invocation: { name: 'init', args: '' },
    });
    expect(parser.parse('please run /init')).toEqual({ kind: 'not_command' });
  });
});

describe('slash command dispatch', () => {
  const builtinRegistry = createBuiltinSlashCommandRegistry();
  const command: SlashCommandDefinition = {
    name: 'echo',
    aliases: ['say'],
    summary: 'Echo a value.',
    usage: '/echo <value>',
    scope: 'session',
    sideEffects: false,
    execute(_context, invocation) {
      return { kind: 'handled', message: invocation.args || 'empty' };
    },
  };
  const registry = new StaticSlashCommandRegistry([helpSlashCommand, command]);

  it('runs registered commands without changing parser logic', () => {
    expect(
      runSlashCommand(
        '/say hello',
        { session, startProjectOnboarding: () => unreachable() },
        {
          registry,
        },
      ),
    ).toEqual({ kind: 'handled', status: 'handled', message: 'hello' });
  });

  it('returns available commands for unknown slash commands', () => {
    expect(
      runSlashCommand(
        '/missing',
        { session, startProjectOnboarding: () => unreachable() },
        {
          registry,
        },
      ),
    ).toEqual({
      kind: 'handled',
      status: 'unknown_command',
      message: 'Command not recognised. Available commands: /echo, /help. Run /help for details.',
    });
  });

  it('lists available commands from the registry via /help', () => {
    expect(
      runSlashCommand(
        '/help',
        { session, startProjectOnboarding: () => unreachable() },
        {
          registry,
        },
      ),
    ).toEqual({
      kind: 'handled',
      status: 'handled',
      message: CUSTOM_HELP_TEXT,
    });
  });

  it('shows command usage details via /help <command>', () => {
    expect(
      runSlashCommand(
        '/help say',
        { session, startProjectOnboarding: () => unreachable() },
        {
          registry,
        },
      ),
    ).toEqual({
      kind: 'handled',
      status: 'handled',
      message: ECHO_HELP_TEXT,
    });
  });

  it('leaves normal chat messages untouched', () => {
    expect(
      runSlashCommand(
        'hello /echo',
        { session, startProjectOnboarding: () => unreachable() },
        {
          registry,
        },
      ),
    ).toEqual({ kind: 'not_command' });
  });

  it('requires Project context for /init', () => {
    expect(
      runSlashCommand(
        '/init',
        {
          session,
          startProjectOnboarding: () => unreachable(),
        },
        { registry: builtinRegistry },
      ),
    ).toEqual({
      kind: 'handled',
      status: 'missing_context',
      message: 'Open a Project with Open Project, then run /init to set up Project instructions.',
    });
  });

  it('runs /init against the resolved Project context without reading the session project id', () => {
    let startedProjectId: string | undefined;

    expect(
      runSlashCommand(
        '/init',
        {
          session,
          project,
          projectId: project.id,
          startProjectOnboarding: (projectId) => {
            startedProjectId = projectId;
            return {
              ...project,
              metadata: {
                onboardingState: 'in_progress',
                onboardingDraft: {
                  id: 'draft-project-1',
                  projectId: project.id,
                  targetPath: 'AGENTS.md',
                  markdown: '# Agent Instructions\n\nReview me.',
                  revision: 1,
                  history: [],
                  createdAtMs: 1,
                  updatedAtMs: 1,
                },
              },
            };
          },
        },
        { registry: builtinRegistry },
      ),
    ).toEqual({
      kind: 'handled',
      status: 'handled',
      message:
        'I prepared a Project instructions draft for AGENTS.md.\n\nI have not created the requested Project files yet.\nReview the draft shown in Project Chat, approve it to enable file edits, then send your request again.',
    });
    expect(startedProjectId).toBe(project.id);
  });

  it('exposes built-in slash command help without invoking command side effects', () => {
    expect(
      runSlashCommand(
        '/help init',
        {
          session,
          startProjectOnboarding: () => unreachable(),
        },
        { registry: builtinRegistry },
      ),
    ).toEqual({
      kind: 'handled',
      status: 'handled',
      message: INIT_HELP_TEXT,
    });
  });

  it('uses structured metadata-backed help that renders as separate entries', () => {
    const result = runSlashCommand(
      '/help',
      { session, startProjectOnboarding: () => unreachable() },
      { registry: builtinRegistry },
    );

    expect(result).toEqual({
      kind: 'handled',
      status: 'handled',
      message: BUILTIN_HELP_TEXT,
    });
    expect(result.message).toContain('- **/help**');
    expect(result.message).toContain('- **/init**');
    expect(result.message).toContain('  - Usage: `/init`');
  });

  it('returns usage copy for invalid /init arguments', () => {
    expect(
      runSlashCommand(
        '/init extra words',
        {
          session,
          startProjectOnboarding: () => unreachable(),
        },
        { registry: builtinRegistry },
      ),
    ).toEqual({
      kind: 'handled',
      status: 'invalid_usage',
      message: 'Usage: /init',
    });
  });
});

function unreachable(): never {
  throw new Error('Unexpected call');
}
