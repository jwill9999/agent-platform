import { expect, type Page } from '@playwright/test';

export type RemoteJourneyBoundary = {
  git: (...args: string[]) => string;
  remote: (...args: string[]) => string;
  write: (path: string, value: string) => void;
  ledger: () =>
    | {
        pullRequests: {
          title: string;
          body: string;
          isDraft: boolean;
          baseRefName: string;
          headRefName: string;
          url: string;
        }[];
        calls: { args: string[] }[];
      }
    | Promise<{
        pullRequests: {
          title: string;
          body: string;
          isDraft: boolean;
          baseRefName: string;
          headRefName: string;
          url: string;
        }[];
        calls: { args: string[] }[];
      }>;
  loseNextCreateResponse: () => void | Promise<void>;
};

/** Runs the same user-visible remote delivery against browser and Electron's real backend. */
export async function runRemotePanelJourney(
  page: Page,
  fixture: RemoteJourneyBoundary,
  branch: string,
  beforePullRequest: () => Promise<void> = async () => {},
) {
  const head = fixture.git('rev-parse', 'HEAD');
  await page.getByRole('tab', { name: 'Git & GitHub' }).click();
  const panel = page.getByRole('complementary', { name: 'Git and GitHub' });
  await panel.getByRole('button', { name: 'Refresh Git state' }).click();
  await panel.getByRole('button', { name: /^Publish(?: \d+)?$/, exact: false }).click();
  await panel.getByRole('button', { name: 'Review publish branch', exact: true }).click();
  const publish = panel.getByRole('region', { name: 'Publish branch', exact: true });
  await expect(publish).toContainText(head);
  await expect(publish).toContainText(`refs/heads/${branch}`);
  expect(fixture.remote('for-each-ref', '--format=%(refname)', `refs/heads/${branch}`)).toBe('');
  await publish.getByRole('button', { name: 'Cancel Git operation' }).click();
  await expect(publish.getByRole('status')).toHaveText('Status: cancelled');
  expect(fixture.remote('for-each-ref', '--format=%(refname)', `refs/heads/${branch}`)).toBe('');
  await panel.getByRole('button', { name: 'Review publish branch', exact: true }).click();
  await publish.getByRole('button', { name: 'Confirm Git operation' }).click();
  await expect(publish.getByRole('status')).toHaveText('Status: succeeded');
  expect(fixture.remote('rev-parse', `refs/heads/${branch}`)).toBe(head);
  expect(fixture.git('rev-parse', '--abbrev-ref', '@{upstream}')).toBe(`origin/${branch}`);
  expect(fixture.git('rev-list', '--count', '@{upstream}..HEAD')).toBe('0');
  await beforePullRequest();
  // A new commit made by another editor must invalidate the old published state.
  fixture.write('second-change.txt', 'Second independently authored change\n');
  fixture.git('add', '--', 'second-change.txt');
  fixture.git('commit', '-m', 'fixture second commit');
  const nextHead = fixture.git('rev-parse', 'HEAD');
  expect(nextHead).not.toBe(head);
  await panel.getByRole('button', { name: 'Refresh Git state' }).click();
  await panel.getByRole('button', { name: /^Push/ }).first().click();
  await panel.getByRole('button', { name: 'Review push', exact: true }).click();
  const push = panel.getByRole('region', { name: 'Push branch', exact: true });
  await expect(push).toContainText(nextHead);
  expect(fixture.remote('rev-parse', `refs/heads/${branch}`)).toBe(head);
  await push.getByRole('button', { name: 'Confirm Git operation' }).click();
  await expect(push.getByRole('status')).toHaveText('Status: succeeded');
  expect(fixture.remote('rev-parse', `refs/heads/${branch}`)).toBe(nextHead);
  expect(fixture.git('rev-list', '--count', '@{upstream}..HEAD')).toBe('0');
  await panel.getByRole('button', { name: /^PRs/ }).click();
  await panel.getByLabel('Title', { exact: true }).fill('Reviewed remote delivery');
  await panel.getByLabel('Description', { exact: true }).fill('Exact human-reviewed description.');
  await panel.getByRole('button', { name: 'staging', exact: true }).click();
  await panel.getByLabel('Create as draft').check();
  await fixture.loseNextCreateResponse();
  await panel.getByRole('button', { name: 'Review pull request', exact: true }).click();
  const pr = panel.getByRole('region', { name: 'Create pull request', exact: true });
  await expect(pr).toContainText('Reviewed remote delivery');
  await expect(pr).toContainText('Exact human-reviewed description.');
  expect((await fixture.ledger()).pullRequests).toHaveLength(0);
  await pr.getByRole('button', { name: 'Confirm Git operation' }).click();
  await expect(pr.getByRole('status')).toHaveText('Outcome unknown — inspect before trying again.');
  await expect(pr.getByRole('button', { name: 'Confirm Git operation' })).toHaveCount(0);
  const created = (await fixture.ledger()).pullRequests;
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({
    title: 'Reviewed remote delivery',
    body: 'Exact human-reviewed description.',
    isDraft: true,
    baseRefName: 'staging',
    headRefName: branch,
  });
  // Reload retrieves the same durable unknown outcome; it must not replay creation.
  await page.reload();
  await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
  // Restoring the saved session remounts its chat/rail. Wait for its persisted
  // message, rather than clicking the initial Project view before that restore.
  await expect(page.getByText('/init', { exact: true })).toBeVisible();
  const gitTab = page.getByRole('tab', { name: 'Git & GitHub' });
  await gitTab.click();
  await expect(gitTab).toHaveAttribute('aria-selected', 'true');
  await expect(pr.getByRole('status')).toHaveText('Outcome unknown — inspect before trying again.');
  await pr.getByRole('button', { name: 'Check actual outcome' }).click();
  await expect(pr.getByRole('status')).toHaveText('Status: succeeded');
  await expect(pr).toContainText('https://github.com/fixture/project/pull/1');
  expect(
    (await fixture.ledger()).calls.filter(({ args }) => args[0] === 'pr' && args[1] === 'create'),
  ).toHaveLength(1);
  expect(fixture.remote('rev-parse', `refs/heads/${branch}`)).toBe(nextHead);
  return {
    initialPublishedHead: head,
    head: nextHead,
    secondCommitRequiredFreshPush: true,
    remoteRef: `refs/heads/${branch}`,
    pullRequestUrl: created[0]!.url,
    cancelledPublishNoEffect: true,
    lostResponseReconciledWithoutReplay: true,
  };
}
