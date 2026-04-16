import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { openApiToToolDefinitions } from '../src/openapi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('openApiToToolDefinitions', () => {
  it('extracts operations with operationId into tool definitions', () => {
    const doc = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/v1/agents': {
          get: {
            operationId: 'listAgents',
            summary: 'List all agents',
          },
          post: {
            operationId: 'createAgent',
            summary: 'Create an agent',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { name: { type: 'string' } } },
                },
              },
            },
          },
        },
      },
    };

    const tools = openApiToToolDefinitions(doc);
    expect(tools).toHaveLength(2);

    const list = tools.find((t) => t.name === 'listAgents');
    expect(list).toBeDefined();
    expect(list!.method).toBe('GET');
    expect(list!.path).toBe('/v1/agents');
    expect(list!.description).toBe('List all agents');

    const create = tools.find((t) => t.name === 'createAgent');
    expect(create).toBeDefined();
    expect(create!.method).toBe('POST');
    expect(create!.parameters).toEqual({
      type: 'object',
      properties: {
        body: { type: 'object', properties: { name: { type: 'string' } } },
      },
      required: ['body'],
    });
  });

  it('includes path parameters in tool parameters', () => {
    const doc = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/v1/agents/{id}': {
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          get: {
            operationId: 'getAgent',
            summary: 'Get agent by ID',
          },
          delete: {
            operationId: 'deleteAgent',
            summary: 'Delete agent',
          },
        },
      },
    };

    const tools = openApiToToolDefinitions(doc);
    expect(tools).toHaveLength(2);

    const get = tools.find((t) => t.name === 'getAgent');
    expect(get!.parameters).toEqual({
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    });
  });

  it('resolves $ref pointers for request body schemas', () => {
    const doc = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/v1/tools': {
          post: {
            operationId: 'createTool',
            summary: 'Create a tool',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Tool' },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Tool: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },
    };

    const tools = openApiToToolDefinitions(doc);
    expect(tools).toHaveLength(1);

    const create = tools[0]!;
    expect(create.parameters).toEqual({
      type: 'object',
      properties: {
        body: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
      required: ['body'],
    });
  });

  it('skips operations without operationId', () => {
    const doc = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/health': {
          get: { summary: 'No operationId' },
        },
        '/v1/agents': {
          get: { operationId: 'listAgents', summary: 'Has ID' },
        },
      },
    };

    const tools = openApiToToolDefinitions(doc);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe('listAgents');
  });

  it('uses fallback description from method + path', () => {
    const doc = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/v1/agents': {
          get: { operationId: 'listAgents' },
        },
      },
    };

    const tools = openApiToToolDefinitions(doc);
    expect(tools[0]!.description).toBe('GET /v1/agents');
  });

  it('returns empty array for empty paths', () => {
    const doc = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } };
    expect(openApiToToolDefinitions(doc)).toEqual([]);
  });

  it('parses the real spec and produces 30 operations', () => {
    const specPath = resolve(
      __dirname,
      '..',
      '..',
      '..',
      'contracts',
      'openapi',
      'agent-platform.yaml',
    );
    const doc = parse(readFileSync(specPath, 'utf-8'));
    const tools = openApiToToolDefinitions(doc);

    expect(tools.length).toBe(31);

    const names = tools.map((t) => t.name);
    expect(names).toContain('listAgents');
    expect(names).toContain('createAgent');
    expect(names).toContain('chatStream');
    expect(names).toContain('getSettings');
    expect(names).toContain('getHealth');
    expect(names).toContain('getReadiness');

    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.method).toMatch(/^(GET|POST|PUT|DELETE|PATCH)$/);
      expect(tool.path).toMatch(/^\//);
    }
  });
});
