import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { budgetApi } from './budgetApi';
import { budgetKeys } from './queryKeys';

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: budgetKeys.all });
}

export function useBudget(userId: string | null) {
  return useQuery({
    queryKey: budgetKeys.current(userId ?? '__disabled__'),
    queryFn: budgetApi.getCurrent,
    enabled: !!userId,
  });
}

export function useSetDefaultBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => budgetApi.setDefault(amount),
    onSuccess: () => invalidate(qc),
  });
}

export function useSetOverrideBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ year, month, amount }: { year: number; month: number; amount: number }) =>
      budgetApi.setOverride(year, month, amount),
    onSuccess: () => invalidate(qc),
  });
}

export function useRemoveOverrideBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      budgetApi.removeOverride(year, month),
    onSuccess: () => invalidate(qc),
  });
}
