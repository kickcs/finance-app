import { inject, computed, type Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';

export function useCurrentUser() {
  const user = inject<Ref<User | null>>('user');
  const userId = computed(() => user?.value?.id ?? '');

  return {
    user,
    userId,
  };
}
