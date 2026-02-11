<script setup lang="ts">
import { computed } from 'vue'
import { UModal, UButton, UIcon } from '@/shared/ui'
import { formatCurrency } from '@/shared/lib/format/currency'
import type { Account, AccountWithBalances } from '@/shared/api/database.types'

const props = defineProps<{
  modelValue: boolean
  account: Account | AccountWithBalances | null
  transactionsCount: number
  currency: string
  isDeleting?: boolean
  error?: string | null
}>()

// Format balances for display
const formattedBalances = computed(() => {
  if (!props.account) return ''
  const acc = props.account
  // Check if it's AccountWithBalances (has balances array)
  if ('balances' in acc && Array.isArray(acc.balances)) {
    return (acc as AccountWithBalances).balances
      .map(b => formatCurrency(b.balance, b.currency))
      .join(' · ')
  }
  // Legacy Account with single balance
  return formatCurrency((acc as Account).balance, props.currency)
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

function close() {
  emit('update:modelValue', false)
  emit('cancel')
}

function confirm() {
  emit('confirm')
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    title="Удалить счёт"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="account" class="space-y-4">
      <!-- Account Info Card -->
      <div class="flex items-center gap-3 p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center"
          :style="{ backgroundColor: `${account.color}20` }"
        >
          <UIcon
            :name="account.icon"
            size="md"
            :style="{ color: account.color }"
          />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
            {{ account.name }}
          </p>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            {{ formattedBalances }}
          </p>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="p-4 rounded-xl bg-warning/10">
        <div class="flex items-start gap-3">
          <UIcon
            name="info"
            size="sm"
            class="text-warning mt-0.5 shrink-0"
          />
          <p class="text-sm text-warning font-medium">
            {{ error }}
          </p>
        </div>
      </div>

      <!-- Warning Message -->
      <div v-else class="p-4 rounded-xl bg-danger/10">
        <div class="flex items-start gap-3">
          <UIcon
            name="warning"
            size="sm"
            class="text-danger mt-0.5 shrink-0"
          />
          <div class="space-y-1">
            <p class="text-sm text-danger font-medium">
              Счёт будет полностью удалён
            </p>
            <p v-if="transactionsCount > 0" class="text-sm text-danger">
              {{ transactionsCount }} {{ transactionsCount === 1 ? 'транзакция будет удалена' : transactionsCount < 5 ? 'транзакции будут удалены' : 'транзакций будут удалены' }}
            </p>
            <p class="text-sm text-danger">
              Это действие нельзя отменить.
            </p>
          </div>
        </div>
      </div>
    </div>

    <template #actions>
      <UButton variant="secondary" full-width @click="close">
        Отмена
      </UButton>
      <UButton
        variant="danger"
        full-width
        :loading="isDeleting"
        :disabled="!!error"
        @click="confirm"
      >
        Удалить
      </UButton>
    </template>
  </UModal>
</template>
