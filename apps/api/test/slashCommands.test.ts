import { describe, expect, it } from 'vitest';

import {
  createBuiltinSlashCommandRegistry,
  helpSlashCommand,
} from '../src/application/slashCommands/builtin.js';
import { DefaultSlashCommandParser } from '../src/application/slashCommands/parser.js';
import { StaticSlashCommandRegistry } from '../src/application/slashCommands/registry.js';
import { runSlashCommand } from '../src/application/slashCommands/runSlashCommand.js';
import type { SlashCommandDefinition } from '../src/application/slashCommands/types.js';

const session = {
  id: 'session-1',
  agentId: 'agent-1',
  mode: 'chat' as const,
  title: null,
  projectId: null,
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
      message:
        'Available slash commands:\n/echo - Echo a value.\n/help - Show available slash commands.',
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
      message:
        '/echo - Echo a value.\nUsage: /echo <value>\nScope: session\nDoes not change state.\nAliases: /say',
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
      message: 'Open a Project first, then run /init to set up Project instructions.',
    });
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
      message:
        '/init - Set up Project instructions for the selected Project.\nUsage: /init\nScope: project\nMay change Project state.',
    });
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
