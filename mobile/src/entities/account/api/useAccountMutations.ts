import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateAccountRelated } from '@/shared/api/invalidation';
import type { Account, AccountWithBalances } from '@/shared/api/database.types';

import { accountsApi } from './accountsApi';
import { accountKeys } from './queryKeys';

interface CreateAccountInput {
  name: string;
  icon: string;
  color: string;
  type: Account['type'];
  balance: number;
  currency: string;
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) => accountsApi.create(input),
    onSuccess: () => invalidateAccountRelated(qc),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Account> }) =>
      accountsApi.update(id, updates),
    onSuccess: () => invalidateAccountRelated(qc),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsApi.delete(id),
    onSuccess: () => invalidateAccountRelated(qc),
  });
}

export function useReorderAccounts(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => accountsApi.reorder(orderedIds),
    onMutate: async (orderedIds) => {
      if (!userId) return { previous: undefined };
      const key = accountKeys.withBalances(userId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<AccountWithBalances[]>(key);
      if (previous) {
        const ordered = orderedIds
          .map((id) => previous.find((a) => a.id === id))
          .filter((a): a is AccountWithBalances => !!a);
        qc.setQueryData(key, ordered);
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (!userId || !ctx?.previous) return;
      qc.setQueryData(accountKeys.withBalances(userId), ctx.previous);
    },
    onSettled: () => invalidateAccountRelated(qc),
  });
}
