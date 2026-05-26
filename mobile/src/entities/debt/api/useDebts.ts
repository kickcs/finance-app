import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invalidateDebtRelated } from '@/shared/api/invalidation';
import type { Debt } from '@/shared/api/database.types';

import { debtsApi, type DebtCreateInput } from './debtsApi';
import { debtKeys } from './queryKeys';
import type { DebtsFilters, DebtsPaginatedCursor } from '../model/types';

const PAGE_SIZE = 10;

export function useDebts(userId: string | null) {
  return useQuery({
    queryKey: debtKeys.byUser(userId ?? '__disabled__'),
    queryFn: debtsApi.getAll,
    enabled: !!userId,
  });
}

export function useInfiniteDebts(userId: string | null, filters?: DebtsFilters) {
  return useInfiniteQuery({
    queryKey: debtKeys.infinite(userId ?? '__disabled__', filters),
    queryFn: ({ pageParam }) => debtsApi.getPaginated(PAGE_SIZE, pageParam, filters),
    initialPageParam: undefined as DebtsPaginatedCursor | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!userId,
  });
}

export function useDebt(debtId: string | null) {
  return useQuery({
    queryKey: debtKeys.detail(debtId ?? '__disabled__'),
    queryFn: () => {
      if (!debtId) throw new Error('debtId is required');
      return debtsApi.getById(debtId);
    },
    enabled: !!debtId,
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DebtCreateInput) => debtsApi.create(input),
    onSuccess: () => invalidateDebtRelated(qc),
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Debt> }) =>
      debtsApi.update(id, updates),
    onSuccess: () => invalidateDebtRelated(qc),
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => debtsApi.delete(id),
    onSuccess: () => invalidateDebtRelated(qc),
  });
}

export function useCloseDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      debtsApi.close(id, accountId),
    onSuccess: () => invalidateDebtRelated(qc),
  });
}

export function usePartialPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      amount,
      accountId,
    }: {
      id: string;
      amount: number;
      accountId: string;
    }) => debtsApi.partialPayment(id, amount, accountId),
    onSuccess: () => invalidateDebtRelated(qc),
  });
}
