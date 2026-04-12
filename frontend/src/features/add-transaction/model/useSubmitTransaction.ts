// frontend/src/features/add-transaction/model/useSubmitTransaction.ts
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/vue-query';
import { transactionsApi, transactionQueryKeys } from '@/entities/transaction';
import { accountQueryKeys } from '@/entities/account';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import { useFeatureHints } from '@/features/feature-hints';
import { CATEGORY_IDS, getCategoryById } from '@/entities/category';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { TransactionFormData } from './useTransactionForm';
import type { Transaction, AccountWithBalances } from '@/shared/api/database.types';
import type { MonthlyStats, PaginatedResult } from '@/entities/transaction/api/transactionsApi';

const TRANSACTION_TYPE_LABELS: Record<TransactionFormData['type'], string> = {
  income: 'Доход',
  expense: 'Расход',
  transfer: 'Перевод',
  debt: 'Долг',
};

interface SubmitPayload {
  userId: string;
  formData: TransactionFormData;
  /** Pre-computed snapshots from synchronous submit() path */
  precomputedSnapshots?: OptimisticSnapshots;
}

interface OptimisticSnapshots {
  recentKey: readonly unknown[];
  listKey: readonly unknown[];
  accountsKey: readonly unknown[];
  monthlyStatsKey: readonly unknown[];
  infinitePrefix: readonly unknown[];
  previousRecent: Transaction[] | undefined;
  previousList: Transaction[] | undefined;
  previousAccounts: AccountWithBalances[] | undefined;
  previousMonthlyStats: MonthlyStats | undefined;
  previousInfinite: [readonly unknown[], InfiniteData<PaginatedResult<Transaction>> | undefined][];
}

type NonDebtTransactionType = Exclude<TransactionFormData['type'], 'debt'>;

function assertNonDebt(
  formData: TransactionFormData,
): asserts formData is TransactionFormData & { type: NonDebtTransactionType } {
  if (formData.type === 'debt') {
    throw new Error('useSubmitTransaction does not handle debt type; use useDebtForm instead');
  }
}

function buildApiPayload(userId: string, formData: TransactionFormData) {
  assertNonDebt(formData);
  const isTransfer = formData.type === 'transfer';
  const categoryId = isTransfer ? CATEGORY_IDS.TRANSFER : formData.categoryId;

  const computedFee =
    isTransfer && formData.feeAmount > 0
      ? formData.feeType === 'percent'
        ? Math.round(((formData.amount * formData.feeAmount) / 100) * 100) / 100
        : formData.feeAmount
      : undefined;

  return {
    user_id: userId,
    account_id: formData.accountId!,
    category_id: categoryId,
    amount: formData.amount,
    currency: formData.currency,
    type: formData.type,
    description: formData.description || null,
    date: new Date(formData.date).toISOString(),
    to_account_id: isTransfer ? formData.toAccountId : null,
    to_amount: isTransfer ? formData.toAmount : null,
    to_currency: isTransfer ? formData.toCurrency : null,
    fee_amount: computedFee,
  };
}

function getCacheKeys(userId: string, formData: TransactionFormData) {
  const txDate = new Date(formData.date);
  return {
    recentKey: transactionQueryKeys.recent(userId),
    listKey: transactionQueryKeys.list(userId),
    accountsKey: accountQueryKeys.list(userId),
    monthlyStatsKey: transactionQueryKeys.monthlyStats(
      userId,
      txDate.getFullYear(),
      txDate.getMonth() + 1,
    ),
    infinitePrefix: transactionQueryKeys.infinitePrefix(),
  };
}

async function cancelRelatedQueries(
  queryClient: QueryClient,
  keys: Pick<
    OptimisticSnapshots,
    'recentKey' | 'listKey' | 'accountsKey' | 'monthlyStatsKey' | 'infinitePrefix'
  >,
) {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: keys.recentKey }),
    queryClient.cancelQueries({ queryKey: keys.listKey }),
    queryClient.cancelQueries({ queryKey: keys.accountsKey }),
    queryClient.cancelQueries({ queryKey: keys.monthlyStatsKey }),
    queryClient.cancelQueries({ queryKey: keys.infinitePrefix }),
  ]);
}

/**
 * Synchronously snapshots current caches and applies optimistic updates.
 * All getQueryData/setQueryData operations are synchronous.
 */
function snapshotAndApplyOptimistic(
  queryClient: QueryClient,
  userId: string,
  formData: TransactionFormData,
): OptimisticSnapshots {
  const isTransfer = formData.type === 'transfer';
  const apiPayload = buildApiPayload(userId, formData);

  const optimisticTx: Transaction = {
    ...apiPayload,
    id: `temp-${Date.now()}`,
    created_at: new Date().toISOString(),
    is_debt_related: false,
    debt_id: null,
    returned_amount: 0,
    net_amount: formData.amount,
    has_debt_returns: false,
  };

  const keys = getCacheKeys(userId, formData);

  // Snapshot previous values (sync)
  const previousRecent = queryClient.getQueryData<Transaction[]>(keys.recentKey);
  const previousList = queryClient.getQueryData<Transaction[]>(keys.listKey);
  const previousAccounts = queryClient.getQueryData<AccountWithBalances[]>(keys.accountsKey);
  const previousMonthlyStats = queryClient.getQueryData<MonthlyStats>(keys.monthlyStatsKey);
  const previousInfinite = queryClient.getQueriesData<InfiniteData<PaginatedResult<Transaction>>>({
    queryKey: keys.infinitePrefix,
  });

  // Apply optimistic updates (all sync)

  // 1. Prepend to recent transactions
  queryClient.setQueryData<Transaction[]>(keys.recentKey, (old) => [
    optimisticTx,
    ...(old ?? []).slice(0, 4),
  ]);

  // 2. Prepend to list
  queryClient.setQueryData<Transaction[]>(keys.listKey, (old) => [optimisticTx, ...(old ?? [])]);

  // 3. Prepend to all infinite queries
  queryClient.setQueriesData<InfiniteData<PaginatedResult<Transaction>> | undefined>(
    { queryKey: keys.infinitePrefix },
    (old) => {
      if (!old || old.pages.length === 0) return old;
      const newPages = [...old.pages];
      newPages[0] = {
        ...newPages[0],
        data: [optimisticTx, ...newPages[0].data],
      };
      return { ...old, pages: newPages };
    },
  );

  // 4. Update account balance
  if (previousAccounts) {
    queryClient.setQueryData<AccountWithBalances[]>(keys.accountsKey, (old) => {
      if (!old) return old;
      return old.map((account) => {
        if (account.id === formData.accountId) {
          let balanceChange = formData.type === 'income' ? formData.amount : -formData.amount;
          if (formData.type === 'transfer' && formData.feeAmount > 0) {
            const computedFee =
              formData.feeType === 'percent'
                ? Math.round(((formData.amount * formData.feeAmount) / 100) * 100) / 100
                : formData.feeAmount;
            balanceChange -= computedFee;
          }
          return {
            ...account,
            balances: account.balances.map((b) =>
              b.currency === formData.currency ? { ...b, balance: b.balance + balanceChange } : b,
            ),
          };
        }
        if (
          isTransfer &&
          account.id === formData.toAccountId &&
          account.id !== formData.accountId &&
          formData.toAmount
        ) {
          return {
            ...account,
            balances: account.balances.map((b) =>
              b.currency === formData.toCurrency
                ? { ...b, balance: b.balance + formData.toAmount! }
                : b,
            ),
          };
        }
        return account;
      });
    });
  }

  // 5. Update monthly stats (only for non-transfer)
  if (!isTransfer && previousMonthlyStats) {
    queryClient.setQueryData<MonthlyStats>(keys.monthlyStatsKey, (old) => {
      if (!old) return old;
      if (formData.type === 'income') {
        return {
          ...old,
          total_income: old.total_income + formData.amount,
          income_by_currency: {
            ...old.income_by_currency,
            [formData.currency]: (old.income_by_currency[formData.currency] ?? 0) + formData.amount,
          },
        };
      }
      return {
        ...old,
        total_expense: old.total_expense + formData.amount,
        expense_by_currency: {
          ...old.expense_by_currency,
          [formData.currency]: (old.expense_by_currency[formData.currency] ?? 0) + formData.amount,
        },
      };
    });
  }

  return {
    ...keys,
    previousRecent,
    previousList,
    previousAccounts,
    previousMonthlyStats,
    previousInfinite,
  };
}

function rollbackFromSnapshots(queryClient: QueryClient, snapshots: OptimisticSnapshots) {
  if (snapshots.previousRecent !== undefined) {
    queryClient.setQueryData(snapshots.recentKey, snapshots.previousRecent);
  }
  if (snapshots.previousList !== undefined) {
    queryClient.setQueryData(snapshots.listKey, snapshots.previousList);
  }
  if (snapshots.previousAccounts !== undefined) {
    queryClient.setQueryData(snapshots.accountsKey, snapshots.previousAccounts);
  }
  if (snapshots.previousMonthlyStats !== undefined) {
    queryClient.setQueryData(snapshots.monthlyStatsKey, snapshots.previousMonthlyStats);
  }
  for (const [key, data] of snapshots.previousInfinite) {
    queryClient.setQueryData(key, data);
  }
}

export function useSubmitTransaction() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { incrementCounter } = useFeatureHints();

  const mutation = useMutation({
    mutationFn: async ({ userId, formData }: SubmitPayload) => {
      return transactionsApi.create(buildApiPayload(userId, formData));
    },

    onMutate: async (variables: SubmitPayload): Promise<OptimisticSnapshots> => {
      const { userId, formData, precomputedSnapshots } = variables;

      // Fire-and-forget path: snapshots already applied synchronously by submit()
      if (precomputedSnapshots) {
        await cancelRelatedQueries(queryClient, precomputedSnapshots);
        return precomputedSnapshots;
      }

      // submitAndWait path: cancel queries first, then apply optimistic updates
      const keys = getCacheKeys(userId, formData);
      await cancelRelatedQueries(queryClient, keys);
      return snapshotAndApplyOptimistic(queryClient, userId, formData);
    },

    onError: (_err, _variables, context) => {
      if (context) {
        rollbackFromSnapshots(queryClient, context);
      }

      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить транзакцию',
        variant: 'error',
        duration: 4000,
      });
    },

    onSuccess: (data, { userId, formData }) => {
      // Increment hint counters
      if (formData.type === 'expense') {
        incrementCounter('expenses_count');
      }

      const transactionId = data.id;
      const onUndo = async () => {
        await rollbackTransaction(transactionId, userId);
      };

      const accounts = queryClient.getQueryData<AccountWithBalances[]>(
        accountQueryKeys.list(userId),
      );
      const account = accounts?.find((a) => a.id === formData.accountId);
      const accountName = account?.name ?? '';
      const category = getCategoryById(formData.categoryId);
      const categoryName = category?.name ?? TRANSACTION_TYPE_LABELS[formData.type];
      const currency = account?.balances?.[0]?.currency ?? formData.currency;
      const amount = formatCurrency(
        formData.type === 'expense' ? -formData.amount : formData.amount,
        currency,
        { showSymbol: false, showSign: formData.type !== 'transfer' },
      );

      toast({
        variant: 'transaction-success',
        duration: 5000,
        transactionData: { amount, categoryName, accountName, onUndo },
      });
    },

    onSettled: (_data, _error, { userId }) => {
      invalidateTransactionRelated(queryClient, userId);
      invalidateAccountRelated(queryClient, userId);
    },
  });

  /**
   * Fire-and-forget submit: applies optimistic updates SYNCHRONOUSLY,
   * then fires API call in background. Safe to navigate immediately after.
   */
  function submit(userId: string, formData: TransactionFormData) {
    const precomputedSnapshots = snapshotAndApplyOptimistic(queryClient, userId, formData);
    mutation.mutate({ userId, formData, precomputedSnapshots });
  }

  /**
   * Awaitable submit: waits for API response (needed for split expense to get transactionId).
   * Optimistic updates applied via onMutate (mutateAsync awaits it).
   */
  async function submitAndWait(
    userId: string,
    formData: TransactionFormData,
  ): Promise<string | null> {
    try {
      const result = await mutation.mutateAsync({ userId, formData });
      return result.id;
    } catch {
      return null;
    }
  }

  /**
   * Rollback a created transaction and invalidate related caches.
   * Used when split debt creation fails after transaction was already created.
   */
  async function rollbackTransaction(transactionId: string, userId: string) {
    try {
      await transactionsApi.delete(transactionId);
      invalidateTransactionRelated(queryClient, userId);
      invalidateAccountRelated(queryClient, userId);
    } catch (e) {
      console.error('Failed to rollback transaction:', e);
      toast({
        title: 'Ошибка отмены',
        description: 'Не удалось отменить транзакцию. Проверьте историю.',
        variant: 'error',
        duration: 5000,
      });
    }
  }

  return {
    isSubmitting: mutation.isPending,
    error: mutation.error,
    submit,
    submitAndWait,
    rollbackTransaction,
  };
}
