import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { useSearchTerm } from './useSearchTerm';

async function typeAndWait(search: ReturnType<typeof useSearchTerm>, value: string, ms: number) {
  search.setQuery(value);
  await nextTick();
  vi.advanceTimersByTime(ms);
  await nextTick();
}

describe('useSearchTerm', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts empty and inactive', () => {
    const search = useSearchTerm();
    expect(search.searchTerm.value).toBe('');
    expect(search.isSearchActive.value).toBe(false);
  });

  it('does not activate search before the debounce delay', async () => {
    const search = useSearchTerm();
    await typeAndWait(search, 'продукты', 100);
    expect(search.isSearchActive.value).toBe(false);
  });

  it('activates search after the debounce delay with ≥2 chars, trimmed', async () => {
    const search = useSearchTerm();
    await typeAndWait(search, '  пр ', 300);
    expect(search.isSearchActive.value).toBe(true);
    expect(search.debouncedTerm.value).toBe('пр');
  });

  it('a single character is not a search', async () => {
    const search = useSearchTerm();
    await typeAndWait(search, 'а', 300);
    expect(search.isSearchActive.value).toBe(false);
  });

  it('clearSearch resets at once, without waiting for the debounce', async () => {
    const search = useSearchTerm();
    await typeAndWait(search, 'продукты', 300);

    search.clearSearch();

    expect(search.searchTerm.value).toBe('');
    expect(search.isSearchActive.value).toBe(false);
  });
});
