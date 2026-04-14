import { describe, expect, it } from 'vitest';

import { expandFencedCodeToOutputs } from '../lib/expandFencedCode';

describe('expandFencedCodeToOutputs', () => {
  it('returns a single text output when there is no fence', () => {
    expect(expandFencedCodeToOutputs('hello')).toEqual([{ type: 'text', content: 'hello' }]);
  });

  it('splits text and fenced code', () => {
    const out = expandFencedCodeToOutputs('intro\n```ts\nconst x = 1\n```\ntrailer');
    expect(out).toEqual([
      { type: 'text', content: 'intro\n' },
      { type: 'code', language: 'ts', content: 'const x = 1' },
      { type: 'text', content: '\ntrailer' },
    ]);
  });
});
