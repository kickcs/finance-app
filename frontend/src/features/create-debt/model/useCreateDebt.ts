import { ref, computed } from 'vue'
import { transactionsApi, transactionQueryKeys } from '@/entities/transaction'
import { debtsApi, debtQueryKeys } from '@/entities/debt'
import { accountQueryKeys } from '@/entities/account'
import { queryClient } from '@/shared/api/queryClient'
import { useToast } from '@/shared/ui'
import type { DebtDirection } from '@/entities/debt'

export interface DebtFormData {
  debt_type: DebtDirection
  person_name: string
  amount: number
  currency: string
  account_id: string | null
  debt_date: string | null
  description: string
  skipTransaction: boolean
}

const initialFormData: DebtFormData = {
  debt_type: 'taken',
  person_name: '',
  amount: 0,
  currency: 'UZS',
  account_id: null,
  debt_date: new Date().toISOString().split('T')[0],
  description: '',
  skipTransaction: false,
}

export function useCreateDebt() {
  const { toast } = useToast()
  const formData = ref<DebtFormData>({ ...initialFormData })
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)

  const isValid = computed(() => {
    return (
      formData.value.person_name.trim().length > 0 &&
      formData.value.amount > 0 &&
      formData.value.account_id !== null &&
      formData.value.currency !== ''
    )
  })

  async function createDebt(userId: string): Promise<string | null> {
    if (!isValid.value || !formData.value.account_id) {
      error.value = 'Заполните все обязательные поля'
      return null
    }

    isSubmitting.value = true
    error.value = null

    // Track what we've done for potential rollback
    let transactionId: string | null = null
    const accountId = formData.value.account_id
    const currency = formData.value.currency

    try {
      const isGiven = formData.value.debt_type === 'given'
      // Given = you lent money = expense (balance decreases)
      // Taken = you borrowed = income (balance increases)
      const transactionType = isGiven ? 'expense' : 'income'
      const categoryId = isGiven ? 'debt_given' : 'debt_taken'

      // 1. Create the linked transaction (backend handles balance update) — unless skipTransaction
      if (!formData.value.skipTransaction) {
        const transaction = await transactionsApi.create({
          user_id: userId,
          account_id: accountId,
          category_id: categoryId,
          amount: formData.value.amount,
          currency: currency,
          type: transactionType,
          description: formData.value.description || `${isGiven ? 'Дал в долг' : 'Взял в долг'}: ${formData.value.person_name}`,
          date: formData.value.debt_date ? new Date(formData.value.debt_date).toISOString() : new Date().toISOString(),
          is_debt_related: true,
        })
        transactionId = transaction.id
      }

      // 2. Create the debt record with currency
      const debtName = `${isGiven ? 'Долг от' : 'Долг для'} ${formData.value.person_name}`
      const debt = await debtsApi.create({
        user_id: userId,
        name: debtName,
        total_amount: formData.value.amount,
        remaining_amount: formData.value.amount,
        debt_type: formData.value.debt_type,
        person_name: formData.value.person_name,
        account_id: accountId,
        transaction_id: transactionId,
        is_closed: false,
        currency: currency,
      })

      // 3. Invalidate caches (including infinite queries and monthly stats)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(userId) }),
        queryClient.invalidateQueries({ queryKey: transactionQueryKeys.list(userId) }),
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.list(userId) }),
        // Invalidate infinite queries
        queryClient.invalidateQueries({ queryKey: ['transactions', 'infinite', userId] }),
        queryClient.invalidateQueries({ queryKey: transactionQueryKeys.infiniteByAccount(accountId) }),
        // Invalidate monthly stats (for dashboard)
        queryClient.invalidateQueries({ queryKey: ['transactions', 'monthly-stats'] }),
      ])

      // Show success toast
      toast({
        title: 'Долг создан',
        description: isGiven
          ? `Вы дали в долг ${formData.value.person_name}`
          : `Вы взяли в долг у ${formData.value.person_name}`,
        variant: 'success',
        duration: 2500,
      })

      return debt.id
    } catch (e) {
      console.error('Failed to create debt:', e)
      error.value = 'Не удалось создать долг'
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать долг',
        variant: 'error',
        duration: 4000,
      })

      // Rollback: delete transaction if needed (backend reverses balance on delete)
      try {
        if (transactionId) {
          await transactionsApi.delete(transactionId)
        }
      } catch (rollbackError) {
        console.error('Failed to rollback debt creation:', rollbackError)
      }

      return null
    } finally {
      isSubmitting.value = false
    }
  }

  function updateField<K extends keyof DebtFormData>(field: K, value: DebtFormData[K]) {
    formData.value[field] = value
  }

  function resetForm() {
    formData.value = { ...initialFormData }
    error.value = null
  }

  return {
    formData,
    isValid,
    isSubmitting,
    error,
    createDebt,
    updateField,
    resetForm,
  }
}
