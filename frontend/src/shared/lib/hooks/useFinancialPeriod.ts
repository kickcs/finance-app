// frontend/src/shared/lib/hooks/useFinancialPeriod.ts
import { computed } from 'vue';
import { useCurrentUser } from './useCurrentUser';
import { useProfile } from '@/shared/api';
import {
  getCurrentFinancialMonth,
  getFinancialMonthBounds,
  getDaysInPeriod,
  getDaysRemainingInPeriod,
} from '@/shared/lib/utils/financialPeriod';

export function useFinancialPeriod() {
  const { userId } = useCurrentUser();
  const { profile } = useProfile(userId);

  const startDay = computed(() => profile.value?.financial_month_start_day ?? 1);
  const isCustomPeriod = computed(() => startDay.value !== 1);

  const currentPeriod = computed(() => getCurrentFinancialMonth(startDay.value));

  const currentBounds = computed(() => {
    const { year, month } = currentPeriod.value;
    return getFinancialMonthBounds(year, month, startDay.value);
  });

  const totalDays = computed(() => {
    const { start, end } = currentBounds.value;
    return getDaysInPeriod(start, end);
  });

  const daysRemaining = computed(() => getDaysRemainingInPeriod(startDay.value));

  return { startDay, isCustomPeriod, currentPeriod, currentBounds, totalDays, daysRemaining };
}
