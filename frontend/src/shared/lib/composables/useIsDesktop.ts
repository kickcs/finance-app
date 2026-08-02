/**
 * Слой платформы переехал в `@/shared/lib/platform`. Файл оставлен реэкспортом,
 * чтобы одиннадцать существующих мест импорта не пришлось править механически.
 */
export { useIsDesktop, DESKTOP_MIN_WIDTH } from '@/shared/lib/platform/useIsDesktop';
