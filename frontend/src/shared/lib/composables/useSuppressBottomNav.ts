import { onScopeDispose, readonly, ref, toValue, watchEffect, type MaybeRefOrGetter } from 'vue';

const suppressed = ref(false);

/** Навигацию прячет оболочка; страница только сообщает, что её панель действий встала на это место. */
export const isBottomNavSuppressed = readonly(suppressed);

/** Пока `active` истинно, нижней навигации нет; уход со страницы её возвращает. */
export function useSuppressBottomNav(active: MaybeRefOrGetter<boolean>) {
  watchEffect(() => {
    suppressed.value = toValue(active);
  });
  onScopeDispose(() => {
    suppressed.value = false;
  });
}
