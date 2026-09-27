import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { budgetQueryKeys } from './queryKeys';
import { budgetApi } from './budgetApi';
import type { BudgetCurrentResponse } from '../model/types';

export function useBudget(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => budgetQueryKeys.current(toValue(userId) ?? ''));

  const invalidateBudgets = () => queryClient.invalidateQueries({ queryKey: budgetQueryKeys.all });

  // Main query — current budget (stale after 5 min; mutations invalidate immediately)
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => budgetApi.getCurrent(),
    enabled: computed(() => !!toValue(userId)),
    staleTime: 5 * 60 * 1000,
  });

  // `||` on purpose: with no budget the backend replies 204 and the HTTP
  // client yields '' — an empty string must normalize to null too.
  const budget = computed(() => data.value || null);

  // The limit itself is set by the user, so it can be patched optimistically;
  // `spent` is server-computed but already cached, so remaining/percentage
  // can be recomputed from it without waiting for a round trip.
  function optimisticAmountPatch(amount: number) {
    return (old: BudgetCurrentResponse | null | undefined): BudgetCurrentResponse | undefined => {
      if (!old) return old ?? undefined;
      return {
        ...old,
        budget: { ...old.budget, amount },
        remaining: amount - old.spent,
        percentage: amount > 0 ? (old.spent / amount) * 100 : 0,
      };
    };
  }

  // Set default budget mutation
  const setDefaultMutation = useMutation({
    mutationFn: (amount: number) => budgetApi.setDefault(amount),
    onMutate: async (amount) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<BudgetCurrentResponse | null>(queryKey.value);
      queryClient.setQueryData(queryKey.value, optimisticAmountPatch(amount));
      return { previous };
    },
    onError: (_err, _amount, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey.value, context.previous);
      }
    },
    onSettled: invalidateBudgets,
  });

  // Set monthly override mutation
  const setOverrideMutation = useMutation({
    mutationFn: ({ year, month, amount }: { year: number; month: number; amount: number }) =>
      budgetApi.setOverride(year, month, amount),
    onMutate: async ({ amount }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<BudgetCurrentResponse | null>(queryKey.value);
      queryClient.setQueryData(queryKey.value, optimisticAmountPatch(amount));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey.value, context.previous);
      }
    },
    onSettled: invalidateBudgets,
  });

  // Remove monthly override mutation
  const removeOverrideMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      budgetApi.removeOverride(year, month),
    onSettled: invalidateBudgets,
  });

  const isSaving = computed(
    () =>
      setDefaultMutation.isPending.value ||
      setOverrideMutation.isPending.value ||
      removeOverrideMutation.isPending.value,
  );

  // Helper functions
  async function setDefault(amount: number) {
    return setDefaultMutation.mutateAsync(amount);
  }

  async function setOverride(year: number, month: number, amount: number) {
    return setOverrideMutation.mutateAsync({ year, month, amount });
  }

  async function removeOverride(year: number, month: number) {
    return removeOverrideMutation.mutateAsync({ year, month });
  }

  return {
    budget,
    isLoading,
    isSaving,
    setDefault,
    setOverride,
    removeOverride,
  };
}
