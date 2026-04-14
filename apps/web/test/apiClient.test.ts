import { describe, expect, it } from 'vitest';

import { API_V1_PREFIX, apiPath } from '../lib/apiClient';

describe('apiPath', () => {
  it('joins segments under the v1 prefix', () => {
    expect(API_V1_PREFIX).toBe('/api/v1');
    expect(apiPath('skills')).toBe('/api/v1/skills');
    expect(apiPath('mcp-servers', 'x')).toBe('/api/v1/mcp-servers/x');
  });

  it('encodes segments', () => {
    expect(apiPath('skills', 'a/b')).toBe('/api/v1/skills/a%2Fb');
  });
});
