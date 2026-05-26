import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { http } from '@/shared/api/http';

const PAGE_SIZE = 20;

type Cursor = { date: string; createdAt: string };

type SearchResponse<T> = {
  data: T[];
  nextCursor: Cursor | null;
  hasMore: boolean;
};

export function useServerSearch<T = unknown>(userId: string | null, query: string) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  return useInfiniteQuery({
    queryKey: ['transactions', 'search', userId, debounced] as const,
    initialPageParam: null as Cursor | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        search: debounced,
        pageSize: String(PAGE_SIZE),
      });
      if (pageParam) {
        params.set('cursorDate', pageParam.date);
        params.set('cursorCreatedAt', pageParam.createdAt);
      }
      return http<SearchResponse<T>>(`/api/transactions?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!userId && debounced.trim().length > 0,
  });
}
