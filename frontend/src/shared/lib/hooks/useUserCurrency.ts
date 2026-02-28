import { computed } from 'vue';
import { useCurrentUser } from './useCurrentUser';
import { useProfile } from '@/shared/api';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

export function useUserCurrency() {
  const { userId } = useCurrentUser();
  const { profile } = useProfile(userId);

  const currency = computed(
    () =>
      profile.value?.currency ||
      localStorage.getItem(STORAGE_KEYS.SELECTED_CURRENCY) ||
      DEFAULT_CURRENCY,
  );

  return {
    currency,
  };
}
