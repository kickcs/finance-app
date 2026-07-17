import { computed } from 'vue';
import { useRoute } from 'vue-router';

export type ToastPosition = 'top' | 'bottom';

/**
 * Позиция тостов задаётся через route meta { toastPosition: 'top' } —
 * фуллскрин-флоу с кнопкой действия внизу (импорт, скан чека) показывают
 * тосты сверху, чтобы не перекрывать кнопку.
 */
export function useToastPosition() {
  const route = useRoute();
  return computed<ToastPosition>(() =>
    (route.meta as { toastPosition?: ToastPosition }).toastPosition === 'top' ? 'top' : 'bottom',
  );
}
