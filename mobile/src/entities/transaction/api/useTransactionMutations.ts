import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateTransactionRelated } from '@/shared/api/invalidation';
import type { Transaction } from '@/shared/api/database.types';

import { transactionsApi, type TransactionCreateInput } from './transactionsApi';

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransactionCreateInput) => transactionsApi.create(input),
    onSuccess: () => invalidateTransactionRelated(qc),
  });
}

interface UpdateInput {
  id: string;
  /**
   * Narrowed to TransactionCreateInput so callers can't try to PATCH server-derived
   * fields (user_id, net_amount, has_debt_returns). transactionsApi.update only
   * forwards a subset to backend anyway — keeping the signature tight prevents
   * silent drops at the API boundary.
   */
  updates: Partial<TransactionCreateInput>;
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: UpdateInput) =>
      transactionsApi.update(id, updates as Partial<Transaction>),
    onSuccess: () => invalidateTransactionRelated(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => invalidateTransactionRelated(qc),
  });
}

interface AdjustBalanceInput {
  accountId: string;
  targetBalance: number;
  currency: string;
  date?: string;
  description?: string;
}

export function useAdjustBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustBalanceInput) => transactionsApi.adjustBalance(input),
    onSuccess: () => invalidateTransactionRelated(qc),
  });
}
