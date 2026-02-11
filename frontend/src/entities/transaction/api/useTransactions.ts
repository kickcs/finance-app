import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { transactionQueryKeys } from './queryKeys'
import { transactionsApi } from './transactionsApi'
import type { Transaction, TransactionInsert } from '@/shared/api/database.types'

export function useTransactions(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient()

  const queryKey = computed(() => {
    const uid = toValue(userId)
    return uid ? transactionQueryKeys.list(uid) : transactionQueryKeys.all
  })

  // Main query
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      const uid = toValue(userId)
      if (!uid) return []
      return transactionsApi.getAll(uid, 50)
    },
    enabled: computed(() => !!toValue(userId)),
  })

  const transactions = computed(() => data.value ?? [])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async ({
      transaction,
      updateBalance,
    }: {
      transaction: Omit<TransactionInsert, 'user_id'>
      updateBalance: (accountId: string, amount: number) => Promise<void>
    }) => {
      const uid = toValue(userId)
      if (!uid) throw new Error('User not authenticated')

      const data = await transactionsApi.create({ ...transaction, user_id: uid })

      // Update account balance (skip for transfers - handled separately)
      if (transaction.type !== 'transfer') {
        const balanceChange = transaction.type === 'income' ? transaction.amount : -transaction.amount
        await updateBalance(transaction.account_id, balanceChange)
      }

      return data
    },
    onMutate: async ({ transaction }) => {
      const uid = toValue(userId)
      if (!uid) return

      await queryClient.cancelQueries({ queryKey: queryKey.value })
      const previousTransactions = queryClient.getQueryData<Transaction[]>(queryKey.value)

      const optimisticTransaction: Transaction = {
        id: `temp-${Date.now()}`,
        user_id: uid,
        created_at: new Date().toISOString(),
        description: null,
        ...transaction,
      } as Transaction

      queryClient.setQueryData<Transaction[]>(queryKey.value, (old) => [
        optimisticTransaction,
        ...(old ?? []),
      ])

      return { previousTransactions }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(queryKey.value, context.previousTransactions)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({
      id,
      updateBalance,
    }: {
      id: string
      updateBalance: (accountId: string, amount: number) => Promise<void>
    }) => {
      const transaction = transactions.value.find((t) => t.id === id)
      if (!transaction) throw new Error('Transaction not found')

      await transactionsApi.delete(id)

      // Revert balance (skip for transfers - they need special handling)
      if (transaction.type !== 'transfer') {
        const balanceRevert = transaction.type === 'income' ? -transaction.amount : transaction.amount
        await updateBalance(transaction.account_id, balanceRevert)
      }
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value })
      const previousTransactions = queryClient.getQueryData<Transaction[]>(queryKey.value)

      queryClient.setQueryData<Transaction[]>(queryKey.value, (old) =>
        old?.filter((t) => t.id !== id) ?? []
      )

      return { previousTransactions }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(queryKey.value, context.previousTransactions)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value })
    },
  })

  // Helper functions (same public API)
  async function createTransaction(
    transaction: Omit<TransactionInsert, 'user_id'>,
    updateBalance: (accountId: string, amount: number) => Promise<void>
  ) {
    return createMutation.mutateAsync({ transaction, updateBalance })
  }

  async function deleteTransaction(
    id: string,
    updateBalance: (accountId: string, amount: number) => Promise<void>
  ) {
    return deleteMutation.mutateAsync({ id, updateBalance })
  }

  async function getByAccount(accountId: string) {
    return transactionsApi.getByAccount(accountId)
  }

  async function getByDateRange(startDate: Date, endDate: Date) {
    const uid = toValue(userId)
    if (!uid) return []
    return transactionsApi.getByDateRange(uid, startDate.toISOString(), endDate.toISOString())
  }

  async function getMonthlySummary(year: number, month: number) {
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)

    const data = await getByDateRange(startDate, endDate)

    // Filter out debt-related transactions and transfers from money flow calculations
    const nonDebtTransactions = data.filter((t) => !t.is_debt_related && t.type !== 'transfer')

    const income = nonDebtTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    const expense = nonDebtTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    return { income, expense, net: income - expense }
  }

  async function getCategoryBreakdown(
    year: number,
    month: number,
    type: 'income' | 'expense' = 'expense'
  ) {
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)

    const data = await getByDateRange(startDate, endDate)

    // Filter out debt-related transactions from category breakdown
    const filtered = data.filter((t) => t.type === type && !t.is_debt_related)

    const breakdown: Record<string, number> = {}

    for (const transaction of filtered) {
      const categoryId = transaction.category_id
      breakdown[categoryId] = (breakdown[categoryId] || 0) + transaction.amount
    }

    return breakdown
  }

  return {
    transactions,
    isLoading,
    error,
    createTransaction,
    deleteTransaction,
    getByAccount,
    getByDateRange,
    getMonthlySummary,
    getCategoryBreakdown,
    refetch,
  }
}
