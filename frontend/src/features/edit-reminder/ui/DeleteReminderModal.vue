<script setup lang="ts">
import { UModal, UButton, UIcon } from '@/shared/ui'
import { formatCurrency } from '@/shared/lib/format/currency'
import type { Reminder } from '@/shared/api/database.types'

const props = defineProps<{
  modelValue: boolean
  reminder: Reminder | null
  currency: string
  isDeleting?: boolean
}>()

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
    title="Удалить подписку"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="reminder" class="space-y-4">
      <!-- Reminder Info Card -->
      <div class="flex items-center gap-3 p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-500/10">
          <UIcon :name="reminder.icon" size="md" class="text-purple-500" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
            {{ reminder.name }}
          </p>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            {{ formatCurrency(reminder.amount, currency) }}
          </p>
        </div>
      </div>

      <!-- Warning Message -->
      <div class="p-4 rounded-xl bg-danger/10">
        <div class="flex items-start gap-3">
          <UIcon
            name="warning"
            size="sm"
            class="text-danger mt-0.5"
          />
          <p class="text-sm text-danger">
            Подписка будет полностью удалена. Это действие нельзя отменить.
          </p>
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
        @click="confirm"
      >
        Удалить
      </UButton>
    </template>
  </UModal>
</template>
