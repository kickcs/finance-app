import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, ref } from 'vue';
import { queryClient } from '../queryClient';
import { useRefreshOnResume, RESUME_REFRESH_THRESHOLD_MS } from './useRefreshOnResume';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useRefreshOnResume', () => {
  let scope: ReturnType<typeof effectScope>;
  let invalidate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    invalidate.mockRestore();
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('перезапрашивает данные после долгого фона, кроме курсов валют', () => {
    scope.run(() => useRefreshOnResume(true));
    setVisibility('hidden');
    vi.advanceTimersByTime(RESUME_REFRESH_THRESHOLD_MS);
    setVisibility('visible');

    expect(invalidate).toHaveBeenCalledTimes(1);
    const { predicate } = invalidate.mock.calls[0][0] as {
      predicate: (q: { queryKey: unknown[] }) => boolean;
    };
    expect(predicate({ queryKey: ['debts', 'list'] })).toBe(true);
    expect(predicate({ queryKey: ['exchangeRates'] })).toBe(false);
  });

  it('не трогает кэш при коротком переключении', () => {
    scope.run(() => useRefreshOnResume(true));
    setVisibility('hidden');
    vi.advanceTimersByTime(RESUME_REFRESH_THRESHOLD_MS - 1);
    setVisibility('visible');

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('молчит без сессии', () => {
    const enabled = ref(false);
    scope.run(() => useRefreshOnResume(enabled));
    setVisibility('hidden');
    vi.advanceTimersByTime(RESUME_REFRESH_THRESHOLD_MS);
    setVisibility('visible');

    expect(invalidate).not.toHaveBeenCalled();
  });
});
