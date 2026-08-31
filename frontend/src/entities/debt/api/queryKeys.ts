import type { DebtsFilters, DebtStatus } from '../model/types';
import { cleanUndefined } from '@/shared/lib/utils';

export const debtQueryKeys = {
  all: ['debts'] as const,
  listPrefix: () => [...debtQueryKeys.all, 'list'] as const,
  // Статус — часть ключа: список без него держит все долги, и экран, которому
  // нужны только активные, не должен читать его кэш.
  list: (userId: string, status?: DebtStatus) =>
    (status
      ? [...debtQueryKeys.listPrefix(), userId, status]
      : [...debtQueryKeys.listPrefix(), userId]) as readonly unknown[],
  transactions: (debtId: string) => [...debtQueryKeys.all, 'transactions', debtId] as const,
  infinitePrefix: () => [...debtQueryKeys.all, 'infinite'] as const,
  infinite: (userId: string, filters?: DebtsFilters) =>
    [...debtQueryKeys.all, 'infinite', userId, cleanUndefined(filters ?? {})] as const,
};

export type DebtQueryKeys = typeof debtQueryKeys;
