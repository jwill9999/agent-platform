import { describe, expect, it } from 'vitest';

import { PlatformSettingsSchema, PlatformSettingsUpdateSchema } from '../src/settings.js';

describe('platform settings contracts', () => {
  it('defaults execution policy to ask for reviewable unknown and state-changing actions', () => {
    expect(PlatformSettingsSchema.parse({})).toMatchObject({
      executionPolicy: {
        unknownToolPolicy: 'ask',
        unknownCommandPolicy: 'ask',
        workspaceWrite: 'ask',
        packageInstall: 'ask',
        network: 'ask',
        gitMutation: 'ask',
        container: 'ask',
      },
    });
  });

  it('accepts partial execution policy updates without requiring unrelated settings', () => {
    expect(
      PlatformSettingsUpdateSchema.parse({
        executionPolicy: {
          unknownCommandPolicy: 'block',
          network: 'block',
        },
      }),
    ).toEqual({
      executionPolicy: {
        unknownCommandPolicy: 'block',
        network: 'block',
      },
    });
  });
});
