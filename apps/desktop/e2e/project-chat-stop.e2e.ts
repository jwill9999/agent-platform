import { test } from '@playwright/test';
import { stopScenarios } from '../../../e2e/support/project-chat-stop/journey.js';
import { nativeStopJourney } from './support/projectChatStopFixture.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const scenario of stopScenarios) {
  test(`Stop shared harness Electron ${scenario}: durable authority, effects and diagnostic export`, async () => {
    test.setTimeout(120_000);
    await nativeStopJourney(test.info(), scenario);
  });
}
