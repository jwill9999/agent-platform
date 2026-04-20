'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SessionRecord } from '@agent-platform/contracts';
import { apiGet, apiPath } from '@/lib/apiClient';

export function useSessions() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await apiGet<SessionRecord[]>(apiPath('sessions'));
      const sorted = (data ?? []).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      setSessions(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sessions, loading, error, refresh };
}
