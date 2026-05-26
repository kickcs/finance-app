import { DEFAULT_CURRENCY } from '@/entities/currency/model/constants';
import { useAuthStore } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';

export function useUserCurrency(): string {
  const user = useAuthStore((s) => s.user);
  const { data: profile } = useProfile(user?.id ?? null);
  return profile?.currency ?? user?.currency ?? DEFAULT_CURRENCY;
}
