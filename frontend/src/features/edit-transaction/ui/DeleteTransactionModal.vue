<script setup lang="ts">
import { computed } from 'vue'
import { UModal, UButton, UIcon } from '@/shared/ui'
import { formatCurrency } from '@/shared/lib/format/currency'
import { getCategoryById } from '@/entities/category'
import type { Transaction } from '@/shared/api/database.types'

const props = defineProps<{
  modelValue: boolean
  transaction: Transaction | null
  currency: string
  isDeleting?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const category = computed(() => {
  if (!props.transaction) return null
  return getCategoryById(props.transaction.category_id)
})

const formattedAmount = computed(() => {
  if (!props.transaction) return ''
  const prefix = props.transaction.type === 'income' ? '+' : '-'
  return `${prefix}${formatCurrency(props.transaction.amount, props.currency)}`
})

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
    title="Удалить"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="transaction" class="space-y-3">
      <!-- Transaction Info Card -->
      <div class="flex items-center gap-2.5 p-3 rounded-lg bg-surface-light dark:bg-surface-dark">
        <div
          class="w-10 h-10 rounded-lg flex items-center justify-center"
          :style="{ backgroundColor: `${category?.color || '#64748b'}15` }"
        >
          <UIcon
            :name="category?.icon || 'receipt_long'"
            size="sm"
            :style="{ color: category?.color || '#64748b' }"
          />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
            {{ category?.name || 'Транзакция' }}
          </p>
          <p
            class="text-sm font-medium"
            :class="transaction.type === 'income' ? 'text-success' : 'text-text-secondary-light dark:text-text-secondary-dark'"
          >
            {{ formattedAmount }}
          </p>
        </div>
      </div>

      <!-- Warning Message -->
      <div class="p-2.5 rounded-lg bg-danger/10">
        <div class="flex items-start gap-2">
          <UIcon
            name="warning"
            size="xs"
            class="text-danger mt-0.5 shrink-0"
          />
          <p class="text-xs text-danger">
            Баланс будет {{ transaction.type === 'income' ? 'уменьшен' : 'увеличен' }} на {{ formatCurrency(transaction.amount, currency) }}
          </p>
        </div>
      </div>
    </div>

    <template #actions>
      <UButton variant="secondary" size="sm" full-width @click="close">
        Отмена
      </UButton>
      <UButton
        variant="danger"
        size="sm"
        full-width
        :loading="isDeleting"
        @click="confirm"
      >
        Удалить
      </UButton>
    </template>
  </UModal>
</template>
