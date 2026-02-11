import { ref, computed } from 'vue'
import { ACCOUNT_ICONS, ACCOUNT_COLORS, accountQueryKeys } from '@/entities/account'
import { accountsApi } from '@/entities/account'
import { queryClient } from '@/shared/api/queryClient'
import { useToast } from '@/shared/ui'

export interface CurrencyBalance {
  currency: string
  balance: number
}

export interface AccountFormData {
  name: string
  balances: CurrencyBalance[]
  icon: string
  color: string
  type: 'basic' | 'savings'
}

export function useCreateAccount() {
  const { toast } = useToast()
  const formData = ref<AccountFormData>({
    name: '',
    balances: [{ currency: 'UZS', balance: 0 }],
    icon: ACCOUNT_ICONS[0],
    color: ACCOUNT_COLORS[0],
    type: 'basic',
  })

  const isValid = computed(() => {
    return (
      formData.value.name.trim().length > 0 &&
      formData.value.balances.length > 0 &&
      formData.value.balances.every((b) => b.currency.length > 0)
    )
  })

  const nameError = computed(() => {
    const name = formData.value.name
    if (name.length === 0) return null
    if (name.trim().length === 0) {
      return 'Название не может состоять только из пробелов'
    }
    if (name.trim().length < 2) {
      return 'Название должно содержать минимум 2 символа'
    }
    if (name.trim().length > 50) {
      return 'Название не должно превышать 50 символов'
    }
    return null
  })

  const isSubmitting = ref(false)
  const error = ref<string | null>(null)

  async function createAccount(userId: string) {
    if (!isValid.value) {
      error.value = 'Введите название счёта и добавьте хотя бы одну валюту'
      return null
    }

    isSubmitting.value = true
    error.value = null

    try {
      const account = await accountsApi.createWithBalances(
        {
          user_id: userId,
          name: formData.value.name.trim(),
          icon: formData.value.icon,
          color: formData.value.color,
          type: formData.value.type,
        },
        formData.value.balances
      )

      // Invalidate accounts cache so Dashboard and other pages refresh
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.list(userId) })

      toast({
        title: 'Счёт создан',
        description: `Счёт "${formData.value.name}" успешно создан`,
        variant: 'success',
        duration: 2500,
      })

      return account.id
    } catch (e) {
      error.value = 'Не удалось создать счёт'
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать счёт',
        variant: 'error',
        duration: 4000,
      })
      console.error('Failed to create account:', e)
      return null
    } finally {
      isSubmitting.value = false
    }
  }

  function updateField<K extends keyof AccountFormData>(field: K, value: AccountFormData[K]) {
    formData.value[field] = value
  }

  // Balance management
  function addCurrency(currency: string = 'USD') {
    // Don't add if currency already exists
    if (formData.value.balances.some((b) => b.currency === currency)) {
      return
    }
    formData.value.balances.push({ currency, balance: 0 })
  }

  function removeCurrency(index: number) {
    if (formData.value.balances.length > 1) {
      formData.value.balances.splice(index, 1)
    }
  }

  function updateBalance(index: number, balance: number) {
    if (formData.value.balances[index]) {
      formData.value.balances[index].balance = balance
    }
  }

  function updateCurrency(index: number, currency: string) {
    if (formData.value.balances[index]) {
      formData.value.balances[index].currency = currency
    }
  }

  function resetForm() {
    formData.value = {
      name: '',
      balances: [{ currency: 'UZS', balance: 0 }],
      icon: ACCOUNT_ICONS[0],
      color: ACCOUNT_COLORS[0],
      type: 'basic',
    }
    error.value = null
  }

  // Get primary currency (first one)
  const primaryCurrency = computed(() => formData.value.balances[0]?.currency ?? 'UZS')

  return {
    formData,
    isValid,
    isSubmitting,
    error,
    nameError,
    primaryCurrency,
    createAccount,
    updateField,
    addCurrency,
    removeCurrency,
    updateBalance,
    updateCurrency,
    resetForm,
  }
}
