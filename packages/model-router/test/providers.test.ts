import { describe, it, expect } from 'vitest';
import { SUPPORTED_PROVIDERS, isSupportedProvider, createLanguageModel } from '../src/providers.js';

describe('providers', () => {
  describe('SUPPORTED_PROVIDERS', () => {
    it('includes openai, anthropic, ollama', () => {
      expect(SUPPORTED_PROVIDERS).toEqual([
        'openai',
        'anthropic',
        'google',
        'deepseek',
        'xai',
        'openrouter',
        'ollama',
        'openai-compatible',
      ]);
    });
  });

  describe('isSupportedProvider', () => {
    it('returns true for supported providers', () => {
      expect(isSupportedProvider('openai')).toBe(true);
      expect(isSupportedProvider('anthropic')).toBe(true);
      expect(isSupportedProvider('ollama')).toBe(true);
    });

    it('returns false for unsupported providers', () => {
      expect(isSupportedProvider('unknown')).toBe(false);
      expect(isSupportedProvider('')).toBe(false);
      expect(isSupportedProvider('OPENAI')).toBe(false);
    });
  });

  describe('createLanguageModel', () => {
    it('creates an openai model', () => {
      const model = createLanguageModel({
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-test',
      });
      expect(model).toBeDefined();
      expect(model.modelId).toBe('gpt-4o');
    });

    it('creates an anthropic model', () => {
      const model = createLanguageModel({
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKey: 'sk-ant-test',
      });
      expect(model).toBeDefined();
      expect(model.modelId).toContain('claude');
    });

    it('creates an ollama model', () => {
      const model = createLanguageModel({
        provider: 'ollama',
        model: 'llama3.2',
      });
      expect(model).toBeDefined();
      expect(model.modelId).toBe('llama3.2');
    });

    it('uses custom baseURL for ollama', () => {
      const model = createLanguageModel({
        provider: 'ollama',
        model: 'llama3.2',
        baseURL: 'http://127.0.0.1:11434/v1',
      });
      expect(model).toBeDefined();
    });

    it('throws for unsupported provider', () => {
      expect(() =>
        createLanguageModel({ provider: 'unknown' as never, model: 'gemini', apiKey: 'key' }),
      ).toThrow('Unsupported model provider');
    });
  });
});
