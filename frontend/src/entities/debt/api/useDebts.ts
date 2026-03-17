import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { debtQueryKeys } from './queryKeys';
import { debtsApi } from './debtsApi';
import type { Debt, DebtInsert } from '@/shared/api/database.types';

export function useDebts(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? debtQueryKeys.list(uid) : debtQueryKeys.all;
  });

  // Main query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return debtsApi.getAll(uid);
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const debts = computed(() => data.value ?? []);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (debt: Omit<DebtInsert, 'user_id'>) => {
      const uid = toValue(userId);
      if (!uid) throw new Error('User not authenticated');
      return debtsApi.create({ ...debt, user_id: uid });
    },
    onMutate: async (newDebt) => {
      const uid = toValue(userId);
      if (!uid) return;

      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousDebts = queryClient.getQueryData<Debt[]>(queryKey.value);

      const optimisticDebt: Debt = {
        id: `temp-${Date.now()}`,
        user_id: uid,
        created_at: new Date().toISOString(),
        monthly_payment: null,
        next_payment_date: null,
        ...newDebt,
      } as Debt;

      queryClient.setQueryData<Debt[]>(queryKey.value, (old) => [optimisticDebt, ...(old ?? [])]);

      return { previousDebts };
    },
    onError: (_err, _newDebt, context) => {
      if (context?.previousDebts) {
        queryClient.setQueryData(queryKey.value, context.previousDebts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Debt> }) =>
      debtsApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousDebts = queryClient.getQueryData<Debt[]>(queryKey.value);

      queryClient.setQueryData<Debt[]>(
        queryKey.value,
        (old) => old?.map((d) => (d.id === id ? { ...d, ...updates } : d)) ?? [],
      );

      return { previousDebts };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDebts) {
        queryClient.setQueryData(queryKey.value, context.previousDebts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => debtsApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousDebts = queryClient.getQueryData<Debt[]>(queryKey.value);

      queryClient.setQueryData<Debt[]>(
        queryKey.value,
        (old) => old?.filter((d) => d.id !== id) ?? [],
      );

      return { previousDebts };
    },
    onError: (_err, _id, context) => {
      if (context?.previousDebts) {
        queryClient.setQueryData(queryKey.value, context.previousDebts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Helper functions (same public API)
  async function createDebt(debt: Omit<DebtInsert, 'user_id'>) {
    return createMutation.mutateAsync(debt);
  }

  async function updateDebt(id: string, updates: Partial<Debt>) {
    return updateMutation.mutateAsync({ id, updates });
  }

  async function makePayment(id: string, amount: number) {
    const debt = debts.value.find((d) => d.id === id);
    if (!debt) throw new Error('Debt not found');

    const newRemaining = Math.max(0, debt.remaining_amount - amount);
    return updateDebt(id, { remaining_amount: newRemaining });
  }

  async function deleteDebt(id: string) {
    return deleteMutation.mutateAsync(id);
  }

  return {
    debts,
    isLoading,
    error,
    createDebt,
    updateDebt,
    makePayment,
    deleteDebt,
    refetch,
  };
}
