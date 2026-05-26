import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { trigger } from '@/shared/lib/haptics';

export interface UsePullToRefreshOptions {
  /**
   * Optional list of query-key prefixes to invalidate. When omitted, the
   * entire React Query cache for the current client is invalidated — fine
   * for a dashboard "refresh everything" gesture, too broad for a single-
   * entity screen.
   */
  queryKeys?: ReadonlyArray<readonly unknown[]>;
  /** Extra async work to run alongside the query refetches. */
  onRefresh?: () => Promise<unknown> | unknown;
}

export interface UsePullToRefreshResult {
  refreshing: boolean;
  onRefresh: () => Promise<void>;
}

export function usePullToRefresh(opts: UsePullToRefreshOptions = {}): UsePullToRefreshResult {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    trigger('selection');
    try {
      if (opts.queryKeys && opts.queryKeys.length > 0) {
        await Promise.all(
          opts.queryKeys.map((qk) =>
            qc.invalidateQueries({ queryKey: [...qk] as unknown[] }),
          ),
        );
      } else {
        await qc.invalidateQueries();
      }
      if (opts.onRefresh) {
        await opts.onRefresh();
      }
    } finally {
      setRefreshing(false);
    }
  }, [opts, qc]);

  return { refreshing, onRefresh };
}
