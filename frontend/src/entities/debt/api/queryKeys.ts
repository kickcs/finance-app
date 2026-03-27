import type { DebtsFilters } from '../model/types';
import { cleanUndefined } from '@/shared/lib/utils';

export const debtQueryKeys = {
  all: ['debts'] as const,
  list: (userId: string) => [...debtQueryKeys.all, 'list', userId] as const,
  detail: (debtId: string) => [...debtQueryKeys.all, 'detail', debtId] as const,
  transactions: (debtId: string) => [...debtQueryKeys.all, 'transactions', debtId] as const,
  infinitePrefix: () => [...debtQueryKeys.all, 'infinite'] as const,
  infinite: (userId: string, filters?: DebtsFilters) =>
    [...debtQueryKeys.all, 'infinite', userId, cleanUndefined(filters ?? {})] as const,
};

export type DebtQueryKeys = typeof debtQueryKeys;
