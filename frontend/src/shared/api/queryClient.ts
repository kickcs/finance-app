import { QueryClient } from '@tanstack/vue-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { getAccessToken, decodeJwtPayload } from './http';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

const PERSIST_STORAGE_KEY = STORAGE_KEYS.QUERY_CACHE;
const MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Query key prefixes that should be persisted to localStorage.
 * Only critical dashboard data — keeps storage small and restore fast.
 *
 * Курсы валют лежат здесь не ради скорости: до их ответа пересчёт возвращает
 * сумму как есть, и мультивалютные итоги успевают отрисоваться чужим числом.
 * Объект крошечный, а живёт он сутки и без персиста.
 */
const PERSISTED_KEY_PREFIXES = ['accounts', 'profile', 'categories', 'exchangeRates'];

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
  const payload = decodeJwtPayload(token);
  return (payload?.sub as string) ?? '';
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

const persister = createAsyncStoragePersister({
  storage: window.localStorage,
  key: PERSIST_STORAGE_KEY,
});

// Setup persistence — restores cache on load, saves on changes
// Buster scopes cache per user: switching users discards stale data
// vue-query's QueryClient is structurally compatible but nominally different
// from @tanstack/query-core's QueryClient, requiring this cast
const [, restored] = persistQueryClient({
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

// Восстановленный снимок — только для мгновенной отрисовки: пока приложение было
// закрыто, данные могли поменяться (например, в Telegram Mini App), поэтому
// сразу помечаем их устаревшими и перезапрашиваем в фоне.
void restored.then(() => queryClient.invalidateQueries({ predicate: isUserDataQuery }));

// Курсы валют не меняются от действий пользователя, а запрос у них тяжелее прочих.
const NON_USER_DATA_PREFIXES = new Set(['exchangeRates']);

/** Запросы, чьи данные может поменять сам пользователь (в т.ч. из другого вебвью). */
export function isUserDataQuery(query: { queryKey: readonly unknown[] }): boolean {
  return !NON_USER_DATA_PREFIXES.has(String(query.queryKey[0]));
}

/** Clear persisted cache (call on logout). Does NOT unsubscribe — persistence stays active for next sign-in. */
export function clearPersistedCache() {
  localStorage.removeItem(PERSIST_STORAGE_KEY);
}
