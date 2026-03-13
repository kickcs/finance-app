import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { budgetQueryKeys } from './queryKeys';
import { budgetApi } from './budgetApi';

export function useBudget(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? budgetQueryKeys.current(uid) : budgetQueryKeys.all;
  });

  // Main query — current budget
  const { data, isLoading } = useQuery({
    queryKey: queryKey,
    queryFn: () => budgetApi.getCurrent(),
    enabled: computed(() => !!toValue(userId)),
  });

  const budget = computed(() => data.value ?? null);

  // Set default budget mutation
  const setDefaultMutation = useMutation({
    mutationFn: (amount: number) => budgetApi.setDefault(amount),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: budgetQueryKeys.all });
    },
  });

  // Set monthly override mutation
  const setOverrideMutation = useMutation({
    mutationFn: ({ year, month, amount }: { year: number; month: number; amount: number }) =>
      budgetApi.setOverride(year, month, amount),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: budgetQueryKeys.all });
    },
  });

  // Remove monthly override mutation
  const removeOverrideMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      budgetApi.removeOverride(year, month),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: budgetQueryKeys.all });
    },
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
