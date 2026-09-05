import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { debtQueryKeys } from './queryKeys';
import { debtsApi } from './debtsApi';
import { useDebtMutations } from './useDebtMutations';
import type { DebtStatus } from '../model/types';

export interface UseDebtsOptions {
  /**
   * Чего просить у сервера. Экраны, которым закрытые долги не нужны, не должны
   * тянуть их ради отсева на клиенте; без статуса приезжают все — так работают
   * экраны долга, где долг может быть уже закрыт.
   */
  status?: DebtStatus;
}

export function useDebts(userId: MaybeRefOrGetter<string | null>, options: UseDebtsOptions = {}) {
  const { status } = options;

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? debtQueryKeys.list(uid, status) : debtQueryKeys.all;
  });

  const { data, isLoading, isFetching, isPending, error, refetch } = useQuery({
    queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return debtsApi.getAll(status);
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const debts = computed(() => data.value ?? []);
  const { createDebt, updateDebt, deleteDebt } = useDebtMutations(userId);

  return {
    debts,
    isLoading,
    isFetching,
    /** Ответа по этому ключу ещё не было — в том числе пока запрос выключен. */
    isPending,
    error,
    createDebt,
    updateDebt,
    deleteDebt,
    refetch,
  };
}
