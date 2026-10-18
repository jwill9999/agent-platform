import { describe, expect, it } from 'vitest';
import { ModelConfigCreateBodySchema, ModelConfigUpdateBodySchema } from '../src/modelConfig.js';

describe('saved provider configuration contracts', () => {
  it.each([
    'openai',
    'anthropic',
    'google',
    'deepseek',
    'xai',
    'openrouter',
    'ollama',
    'openai-compatible',
  ])('accepts researched provider %s with exact case model IDs', (provider) => {
    expect(
      ModelConfigCreateBodySchema.parse({ name: 'one', provider, model: '  MixedCase/Model  ' }),
    ).toMatchObject({ provider, model: 'MixedCase/Model' });
  });
  it('rejects unknown providers and blank model IDs', () => {
    expect(
      ModelConfigCreateBodySchema.safeParse({ name: 'one', provider: 'unknown', model: 'm' })
        .success,
    ).toBe(false);
    expect(ModelConfigUpdateBodySchema.safeParse({ model: ' ' }).success).toBe(false);
  });
  it.each([
    'https://endpoint.example/v1',
    'http://localhost:9999/v1',
    'http://127.0.0.1:9999/v1',
    'http://[::1]:9999/v1',
  ])('accepts HTTPS or explicit HTTP loopback %s', (baseURL) => {
    expect(ModelConfigUpdateBodySchema.parse({ baseURL }).baseURL).toBe(baseURL);
  });
  it.each([
    'http://remote.example/v1',
    'https://user:password@remote.example/v1',
    'https://remote.example/v1?key=secret',
    'https://remote.example/v1#secret',
    'file:///private/file',
    'not a URL',
  ])('rejects unsafe endpoint %s', (baseURL) => {
    expect(ModelConfigUpdateBodySchema.safeParse({ baseURL }).success).toBe(false);
  });
  it('supports explicit endpoint clearing without changing omitted fields', () => {
    expect(ModelConfigUpdateBodySchema.parse({ baseURL: null })).toEqual({ baseURL: null });
    expect(ModelConfigUpdateBodySchema.parse({})).toEqual({});
  });
});
