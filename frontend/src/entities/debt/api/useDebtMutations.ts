import { toValue, type MaybeRefOrGetter } from 'vue';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/vue-query';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import type { Debt, DebtInsert } from '@/shared/api/database.types';
import type { DebtUpdate } from '../model/types';
import { debtQueryKeys } from './queryKeys';
import { debtsApi, type OffsetResult } from './debtsApi';
import {
  snapshotDebtCaches,
  restoreDebtCaches,
  applyDebtUpdate,
  applyDebtRemove,
  type DebtCacheSnapshot,
} from './debtCache';

/**
 * Единственная точка записи для долгов.
 *
 * Долг никогда не меняется в одиночку: за ним тянутся транзакция возврата и
 * баланс счёта. Раньше каждый вызывающий сам решал, что сбросить, — и половина
 * сбрасывала только `debtQueryKeys.all`, оставляя историю и балансы устаревшими.
 * Здесь у всех мутаций один и тот же хвост: оптимистичная правка кэша,
 * откат при ошибке, `invalidateDebtRelated` после.
 */
export function useDebtMutations(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  function invalidate(): Promise<void> | undefined {
    const uid = toValue(userId);
    return uid ? invalidateDebtRelated(queryClient, uid) : undefined;
  }

  /** Снимок всех кэшей долга — общий пролог оптимистичных мутаций. */
  async function snapshot(): Promise<{ snapshot: DebtCacheSnapshot }> {
    return { snapshot: await snapshotDebtCaches(queryClient) };
  }

  function rollback(context: { snapshot: DebtCacheSnapshot } | undefined) {
    if (context) restoreDebtCaches(queryClient, context.snapshot);
  }

  // Создание — единственная мутация без общего пролога: новый долг некуда
  // вставить в курсорную ленту (порядок групп решает сервер), поэтому
  // оптимистично он попадает только в плоские списки.
  const createMutation = useMutation({
    mutationFn: (debt: Omit<DebtInsert, 'user_id'>) => {
      const uid = toValue(userId);
      if (!uid) throw new Error('User not authenticated');
      return debtsApi.create({ ...debt, user_id: uid });
    },
    onMutate: async (newDebt) => {
      const uid = toValue(userId);
      if (!uid) return;
      const snap = await snapshotDebtCaches(queryClient);
      insertIntoListCaches(queryClient, buildOptimisticDebt(uid, newDebt));
      return { snapshot: snap };
    },
    onError: (_err, _newDebt, context) => rollback(context),
    onSettled: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: DebtUpdate }) =>
      debtsApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      const context = await snapshot();
      applyDebtUpdate(queryClient, id, updates);
      return context;
    },
    onError: (_err, _variables, context) => rollback(context),
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => debtsApi.delete(id),
    onMutate: async (id) => {
      const context = await snapshot();
      applyDebtRemove(queryClient, id);
      return context;
    },
    onError: (_err, _id, context) => rollback(context),
    onSettled: invalidate,
  });

  // Отмена закрытия и зачёт считает сервер: он трогает несколько записей разом,
  // и предсказать результат на клиенте нечем. Ответ применяется как есть.
  const reopenMutation = useMutation({
    mutationFn: (id: string) => debtsApi.reopen(id),
    onSuccess: (debt) => applyDebtUpdate(queryClient, debt.id, debt),
    onSettled: invalidate,
  });

  const offsetMutation = useMutation({
    mutationFn: ({ personName, currency }: { personName: string; currency: string }) =>
      debtsApi.offset(personName, currency),
    onSuccess: (result) => {
      for (const debt of result.debts) applyDebtUpdate(queryClient, debt.id, debt);
    },
    onSettled: invalidate,
  });

  return {
    createDebt: (debt: Omit<DebtInsert, 'user_id'>): Promise<Debt> =>
      createMutation.mutateAsync(debt),
    updateDebt: (id: string, updates: DebtUpdate): Promise<Debt> =>
      updateMutation.mutateAsync({ id, updates }),
    deleteDebt: (id: string): Promise<void> => deleteMutation.mutateAsync(id),
    reopenDebt: (id: string): Promise<Debt> => reopenMutation.mutateAsync(id),
    offsetDebts: (personName: string, currency: string): Promise<OffsetResult> =>
      offsetMutation.mutateAsync({ personName, currency }),
  };
}

function buildOptimisticDebt(userId: string, input: Omit<DebtInsert, 'user_id'>): Debt {
  return {
    id: `temp-${Date.now()}`,
    user_id: userId,
    created_at: new Date().toISOString(),
    monthly_payment: null,
    next_payment_date: null,
    debt_type: input.debt_type ?? 'given',
    person_name: input.person_name ?? null,
    account_id: input.account_id ?? null,
    transaction_id: input.transaction_id ?? null,
    close_transaction_id: null,
    is_closed: false,
    currency: input.currency ?? 'USD',
    source_transaction_id: input.source_transaction_id ?? null,
    description: input.description ?? null,
    closed_at: null,
    forgiven_amount: input.forgiven_amount ?? 0,
    fee_transaction_id: null,
    is_private: input.is_private ?? false,
    ...input,
    // После спреда: в DebtInsert поле необязательное, а в Debt — нет
    fee_amount: input.fee_amount ?? 0,
  };
}

function insertIntoListCaches(queryClient: QueryClient, debt: Debt): void {
  queryClient.setQueriesData<Debt[]>({ queryKey: debtQueryKeys.listPrefix() }, (old) =>
    old ? [debt, ...old] : old,
  );
}
