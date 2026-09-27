import { toValue, type MaybeRefOrGetter } from 'vue';
import { useEventListener } from '@vueuse/core';
import { queryClient, isUserDataQuery } from '../queryClient';

/** Короче этого фон считаем переключением «туда-обратно», а не уходом. */
export const RESUME_REFRESH_THRESHOLD_MS = 15_000;

/**
 * Перезапрашивает данные, когда приложение возвращается из фона.
 * Изменения из Telegram Mini App живут в другом вебвью: ни общего кэша,
 * ни событий между ними нет, поэтому единственный сигнал — возврат пользователя.
 */
export function useRefreshOnResume(enabled: MaybeRefOrGetter<boolean>) {
  let hiddenAt: number | null = null;

  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    const awayMs = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    if (awayMs < RESUME_REFRESH_THRESHOLD_MS || !toValue(enabled)) return;

    void queryClient.invalidateQueries({ predicate: isUserDataQuery });
  });
}
