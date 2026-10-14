'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'agent-platform:projectEvidenceVisible';

/** Layout preference only: does not change Project permissions or chat approvals. */
export function useProjectEvidenceVisibility(previewDocked: boolean) {
  const [preferredVisible, setVisible] = useState(true);
  const [wideViewport, setWideViewport] = useState(false);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return;
    const media = globalThis.matchMedia('(min-width: 64rem)');
    const updateViewport = () => setWideViewport(media.matches);
    updateViewport();
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    try {
      setVisible(globalThis.localStorage.getItem(STORAGE_KEY) !== '0');
    } catch {
      // Storage can be unavailable; the panel remains usable for this session.
    }
  }, []);

  const update = useCallback((next: boolean) => {
    setVisible(next);
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // A persistence failure must not prevent changing the current layout.
    }
  }, []);

  const unavailableReason = !wideViewport
    ? 'Widen the window to show the activity and Git panel.'
    : previewDocked
      ? null
      : 'Dock the web preview to show the activity and Git panel.';

  return {
    visible: preferredVisible && unavailableReason === null,
    unavailableReason,
    setVisible: update,
  };
}
