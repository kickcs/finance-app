import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockTransactionResponse } from '@/test/mocks/handlers/transactions';
import { useServerSearch } from './useServerSearch';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

/**
 * Mount a minimal component that exposes useServerSearch to the test.
 */
function mountServerSearch(userId: string | null) {
  const userIdRef = ref(userId);
  let exposed: ReturnType<typeof useServerSearch> | null = null;

  const TestComponent = defineComponent({
    setup() {
      exposed = useServerSearch(userIdRef);
      return () => h('div');
    },
  });

  const wrapper = mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
    },
  });

  return {
    wrapper,
    userIdRef,
    get exposed() {
      return exposed!;
    },
  };
}

// ---------------------------------------------------------------------------

describe('useServerSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    server.resetHandlers();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('starts with empty searchTerm', () => {
      const { exposed } = mountServerSearch('user-1');
      expect(exposed.searchTerm.value).toBe('');
    });

    it('isSearchActive is false when no term', () => {
      const { exposed } = mountServerSearch('user-1');
      expect(exposed.isSearchActive.value).toBe(false);
    });

    it('results start empty', () => {
      const { exposed } = mountServerSearch('user-1');
      expect(exposed.results.value).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Debounce behaviour
  // -------------------------------------------------------------------------
  describe('debounce', () => {
    it('does not activate search before debounce delay', async () => {
      const { exposed } = mountServerSearch('user-1');
      exposed.setQuery('продукты');
      await nextTick();
      // 100ms elapsed — not yet debounced (300ms)
      vi.advanceTimersByTime(100);
      await nextTick();
      expect(exposed.isSearchActive.value).toBe(false);
    });

    it('activates search after debounce delay with ≥2 chars', async () => {
      const { exposed } = mountServerSearch('user-1');
      exposed.setQuery('пр');
      await nextTick();
      vi.advanceTimersByTime(300);
      await nextTick();
      expect(exposed.isSearchActive.value).toBe(true);
    });

    it('does not activate search for single character (< MIN_SEARCH_LENGTH=2)', async () => {
      const { exposed } = mountServerSearch('user-1');
      exposed.setQuery('а');
      await nextTick();
      vi.advanceTimersByTime(300);
      await nextTick();
      expect(exposed.isSearchActive.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // clearSearch
  // -------------------------------------------------------------------------
  describe('clearSearch', () => {
    it('resets searchTerm to empty', async () => {
      const { exposed } = mountServerSearch('user-1');
      exposed.setQuery('продукты');
      vi.advanceTimersByTime(300);
      await nextTick();

      exposed.clearSearch();
      await nextTick();
      expect(exposed.searchTerm.value).toBe('');
      expect(exposed.isSearchActive.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Null userId — search disabled
  // -------------------------------------------------------------------------
  describe('null userId', () => {
    it('isSearchActive remains false when userId is null', async () => {
      const { exposed } = mountServerSearch(null);
      exposed.setQuery('продукты');
      vi.advanceTimersByTime(300);
      await nextTick();
      // query is enabled only when userId is truthy
      expect(exposed.isSearchActive.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // API integration (real timer for flushPromises)
  // -------------------------------------------------------------------------
  describe('API integration', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('returns search results from API', async () => {
      server.use(
        http.get('*/api/transactions', () =>
          HttpResponse.json({
            data: [{ ...mockTransactionResponse, id: 'tx-found', description: 'Продукты' }],
            nextCursor: null,
            hasMore: false,
          }),
        ),
      );

      const { exposed } = mountServerSearch('user-1');

      // Must set at least 2 chars
      exposed.setQuery('пр');
      // Wait for debounce (300ms) + fetch
      await new Promise((r) => setTimeout(r, 400));
      await flushPromises();

      expect(exposed.results.value.length).toBeGreaterThan(0);
    });

    it('isEmpty becomes true when search returns no results', async () => {
      server.use(
        http.get('*/api/transactions', () =>
          HttpResponse.json({ data: [], nextCursor: null, hasMore: false }),
        ),
      );

      const { exposed } = mountServerSearch('user-1');
      exposed.setQuery('xyznonematch');
      await new Promise((r) => setTimeout(r, 400));
      await flushPromises();

      expect(exposed.isEmpty.value).toBe(true);
      expect(exposed.results.value).toHaveLength(0);
    });
  });
});
