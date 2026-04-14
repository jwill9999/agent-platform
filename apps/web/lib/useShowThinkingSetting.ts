'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY_SHOW_THINKING = 'agent-platform:showThinking';

/**
 * Stub user setting: show "thinking" / reasoning blocks in the chat UI.
 */
export function useShowThinkingSetting(): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_SHOW_THINKING);
      if (raw === '1' || raw === 'true') {
        setValue(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const set = useCallback((next: boolean) => {
    setValue(next);
    try {
      window.localStorage.setItem(STORAGE_KEY_SHOW_THINKING, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  return [value, set];
}
