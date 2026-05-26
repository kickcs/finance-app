import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateAccountRelated } from '@/shared/api/invalidation';
import type { Account } from '@/shared/api/database.types';

import { accountsApi } from './accountsApi';

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
