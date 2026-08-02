import { ref, type Ref } from 'vue';

/** Единственная граница между мобильной и десктопной версией приложения. */
export const DESKTOP_MIN_WIDTH = 1024;

const MEDIA_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;

/**
 * Состояние заводится вне какого-либо effect scope и живёт весь сеанс.
 *
 * Прошлая версия использовала `useMediaQuery` из VueUse: он вешает слушатель
 * через `useEventListener`, привязанный к текущему scope. Первый вызвавший
 * компонент забирал подписку себе, и после его размонтирования закэшированный
 * `ref` замирал.
 */
let state: Ref<boolean> | null = null;
let override: Ref<boolean> | null = null;

function createState(): Ref<boolean> {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return ref(false);
  }

  const mql = window.matchMedia(MEDIA_QUERY);
  const value = ref(mql.matches);
  mql.addEventListener('change', (event) => {
    value.value = event.matches;
  });
  return value;
}

export function useIsDesktop(): Ref<boolean> {
  if (override) return override;
  if (!state) state = createState();
  return state;
}

/** Точка подмены для тестов. `null` возвращает реальное состояние. */
export function setIsDesktopForTests(value: boolean | null): void {
  if (value === null) {
    override = null;
    return;
  }
  if (override) {
    override.value = value;
    return;
  }
  override = ref(value);
}
