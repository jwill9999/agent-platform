// @vitest-environment jsdom

import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectEvidenceToggle } from '@/components/project/project-evidence-toggle';
import { useProjectEvidenceVisibility } from '@/lib/useProjectEvidenceVisibility';

function PreferenceControl({ docked = true }: { docked?: boolean }) {
  const { visible, setVisible, unavailableReason } = useProjectEvidenceVisibility(docked);
  return createElement(ProjectEvidenceToggle, {
    visible,
    onVisibleChange: setVisible,
    unavailableReason,
  });
}

let container: HTMLDivElement;
let root: Root;
let media: EventTarget & { matches: boolean };

async function resize(wide: boolean) {
  await act(async () => {
    media.matches = wide;
    media.dispatchEvent(new Event('change'));
  });
}

async function mount() {
  root = createRoot(container);
  await act(async () => root.render(createElement(PreferenceControl)));
}

function button() {
  const element = container.querySelector('button');
  if (!element) throw new Error('Missing panel visibility control');
  return element;
}

async function toggle() {
  await act(async () => button().click());
}

beforeEach(async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  media = Object.assign(new EventTarget(), { matches: true });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  await mount();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Project activity and Git visibility', () => {
  it('defaults to shown and exposes an accessible control that remains after hiding', async () => {
    expect(button().getAttribute('aria-label')).toBe('Hide activity and Git panel');
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(button().getAttribute('aria-controls')).toBe('project-evidence-rail');
    expect(button().type).toBe('button');
    await toggle();
    expect(button().getAttribute('aria-label')).toBe('Show activity and Git panel');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(button().getAttribute('aria-disabled')).toBe('false');
    expect(button().hasAttribute('aria-controls')).toBe(false);
    await toggle();
    expect(button().getAttribute('aria-expanded')).toBe('true');
  });

  it('remembers both hidden and shown preferences across fresh mounts', async () => {
    await toggle();
    await act(async () => root.unmount());
    await mount();
    expect(button().getAttribute('aria-expanded')).toBe('false');
    await toggle();
    await act(async () => root.unmount());
    await mount();
    expect(button().getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps the toggle usable when storage reads and writes fail', async () => {
    await act(async () => root.unmount());
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    await mount();
    expect(button().getAttribute('aria-expanded')).toBe('true');
    await toggle();
    expect(button().getAttribute('aria-expanded')).toBe('false');
    await toggle();
    expect(button().getAttribute('aria-expanded')).toBe('true');
  });

  it('falls back to shown for an unrecognised persisted value without rewriting it', async () => {
    await act(async () => root.unmount());
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('invalid');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await mount();
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(write).not.toHaveBeenCalled();
  });

  it('reports unavailable at narrow widths without discarding the preference', async () => {
    await resize(false);
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(button().getAttribute('aria-label')).toBe('Activity and Git panel unavailable');
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(button().hasAttribute('aria-controls')).toBe(false);
    const reason = document.getElementById(button().getAttribute('aria-describedby') ?? '');
    expect(reason?.textContent).toBe('Widen the window to show the activity and Git panel.');
    await toggle();
    await resize(true);
    expect(button().getAttribute('aria-expanded')).toBe('true');
    await toggle();
    await resize(false);
    await resize(true);
    expect(button().getAttribute('aria-label')).toBe('Show activity and Git panel');
  });

  it('reports unavailable while web preview is expanded and restores the prior preference', async () => {
    await act(async () => root.render(createElement(PreferenceControl, { docked: false })));
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(button().getAttribute('aria-disabled')).toBe('true');
    const reason = document.getElementById(button().getAttribute('aria-describedby') ?? '');
    expect(reason?.textContent).toBe('Dock the web preview to show the activity and Git panel.');
    await toggle();
    await act(async () => root.render(createElement(PreferenceControl, { docked: true })));
    expect(button().getAttribute('aria-expanded')).toBe('true');
  });

  it('removes the viewport subscription on unmount', async () => {
    const remove = vi.spyOn(media, 'removeEventListener');
    await act(async () => root.unmount());
    expect(remove).toHaveBeenCalledWith('change', expect.any(Function));
    await mount();
  });

  it('does not send network requests when changing the layout', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await toggle();
    await toggle();
    expect(fetch).not.toHaveBeenCalled();
  });
});
