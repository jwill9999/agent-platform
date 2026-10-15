// @vitest-environment jsdom
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { useProjectEvidenceView } from '@/lib/useProjectEvidenceView';

let container: HTMLDivElement;
let root: Root;
let selection: ReturnType<typeof useProjectEvidenceView>;

function Probe({ projectId }: { projectId: string | null }) {
  selection = useProjectEvidenceView(projectId);
  return createElement('output', null, selection.view);
}

async function render(projectId: string | null) {
  await act(async () => root.render(createElement(Probe, { projectId })));
}

beforeEach(async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await render('alpha');
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it('rejects callbacks from a previous visit even when the same project is opened again', async () => {
  const oldAlpha = selection.setView;
  await act(async () => selection.setView('git'));
  await render('beta');
  expect(container.textContent).toBe('activity');
  await render('alpha');
  await act(async () => oldAlpha('git'));
  expect(container.textContent).toBe('activity');
  await act(async () => selection.setView('git'));
  expect(container.textContent).toBe('git');
});

it('drops a hidden project selection when returning Home and ignores callbacks outside Project mode', async () => {
  await act(async () => selection.setView('git'));
  await render(null);
  expect(container.textContent).toBe('activity');
  const outside = selection.setView;
  await act(async () => outside('git'));
  expect(container.textContent).toBe('activity');
  await render('alpha');
  await act(async () => outside('git'));
  expect(container.textContent).toBe('activity');
});
