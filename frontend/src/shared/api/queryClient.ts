import { QueryClient } from '@tanstack/vue-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { getAccessToken } from './http';

const PERSIST_STORAGE_KEY = 'ouro-query-cache';
const MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Query key prefixes that should be persisted to localStorage.
 * Only critical dashboard data — keeps storage small and restore fast.
 */
const PERSISTED_KEY_PREFIXES = ['accounts', 'profile', 'categories'];

/** Check if a query key should be persisted */
function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const prefix = queryKey[0];
  if (typeof prefix !== 'string') return false;
  // 'transactions' keys: only persist 'recent' and 'monthly-stats' subkeys
  if (prefix === 'transactions') {
    return queryKey.includes('recent') || queryKey.includes('monthly-stats');
  }
  return PERSISTED_KEY_PREFIXES.includes(prefix);
}

/** Extract user ID from JWT access token for cache scoping */
function getCurrentUserId(): string {
  const token = getAccessToken();
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? '';
  } catch {
    return '';
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: MAX_AGE, // Match persistence maxAge so restored data isn't GC'd
      refetchOnWindowFocus: false,
      retry: 1,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: PERSIST_STORAGE_KEY,
});

// Setup persistence — restores cache on load, saves on changes
// Buster scopes cache per user: switching users discards stale data
// vue-query's QueryClient is structurally compatible but nominally different
// from @tanstack/query-core's QueryClient, requiring this cast
persistQueryClient({
  queryClient: queryClient as any,
  persister,
  maxAge: MAX_AGE,
  buster: getCurrentUserId(),
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      // Only persist successful queries that match our whitelist
      return query.state.status === 'success' && shouldPersistQuery(query.queryKey);
    },
  },
});

/** Clear persisted cache (call on logout). Does NOT unsubscribe — persistence stays active for next sign-in. */
export function clearPersistedCache() {
  localStorage.removeItem(PERSIST_STORAGE_KEY);
}
