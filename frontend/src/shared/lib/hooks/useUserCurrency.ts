import { computed } from 'vue';
import { useCurrentUser } from './useCurrentUser';
import { useProfile } from '@/shared/api';

export function useUserCurrency() {
  const { userId } = useCurrentUser();
  const { profile } = useProfile(userId);

  const currency = computed(
    () =>
      profile.value?.currency ||
      localStorage.getItem('selectedCurrency') ||
      'UZS',
  );

  return {
    currency,
  };
}
