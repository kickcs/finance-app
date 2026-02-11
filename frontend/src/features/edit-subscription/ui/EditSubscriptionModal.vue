<script setup lang="ts">
import { computed } from 'vue'
import { UInput, UButton, UTabs, UIcon } from '@/shared/ui'
import { FREQUENCY_LABELS, type Reminder } from '@/entities/reminder'
import { IconSelector, ColorPicker } from '@/features/create-reminder'
import type { SubscriptionFormData } from '../model/useEditSubscription'
import { formatCurrency } from '@/shared/lib/format/currency'

const props = defineProps<{
  isOpen: boolean
  isEditing: boolean
  subscription: Reminder | null
  formData: SubscriptionFormData
  isSubmitting: boolean
  isDeleting: boolean
  showDeleteConfirm: boolean
  error: string | null
  currency: string
}>()

const emit = defineEmits<{
  close: []
  'start-editing': []
  'cancel-editing': []
  'update-field': [field: keyof SubscriptionFormData, value: SubscriptionFormData[keyof SubscriptionFormData]]
  save: []
  'request-delete': []
  'cancel-delete': []
  'confirm-delete': []
}>()

const frequencyTabs = Object.entries(FREQUENCY_LABELS).map(([id, label]) => ({
  id,
  label,
}))

const isFormValid = computed(() => {
  return props.formData.name.trim().length > 0 && props.formData.amount > 0
})

const frequencyLabel = computed(() => {
  if (!props.subscription) return ''
  return FREQUENCY_LABELS[props.subscription.frequency] || props.subscription.frequency
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen && subscription"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="$emit('close')"
        />

        <!-- Modal Content -->
        <div
          class="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto
                 bg-card-light dark:bg-card-dark
                 rounded-t-3xl sm:rounded-2xl
                 shadow-2xl"
        >
          <!-- Header -->
          <div class="sticky top-0 z-10 px-4 pt-4 pb-3 bg-card-light dark:bg-card-dark border-b border-gray-100 dark:border-gray-800">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                {{ isEditing ? 'Редактировать' : 'Подписка' }}
              </h2>
              <button
                class="w-7 h-7 flex items-center justify-center rounded-full
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                @click="$emit('close')"
              >
                <UIcon name="close" size="xs" class="text-text-secondary-light dark:text-text-secondary-dark" />
              </button>
            </div>
          </div>

          <!-- View Mode -->
          <div v-if="!isEditing" class="p-4 space-y-4">
            <!-- Subscription Info -->
            <div class="flex items-center gap-3">
              <div
                class="w-11 h-11 rounded-xl flex items-center justify-center"
                :style="{ backgroundColor: subscription.color + '20' }"
              >
                <UIcon
                  :name="subscription.icon"
                  size="md"
                  :style="{ color: subscription.color }"
                />
              </div>
              <div class="flex-1">
                <h3 class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {{ subscription.name }}
                </h3>
                <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  {{ frequencyLabel }}
                </p>
              </div>
            </div>

            <!-- Amount & Date Row -->
            <div class="grid grid-cols-2 gap-2">
              <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-0.5">
                  Сумма
                </p>
                <p class="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                  {{ formatCurrency(subscription.amount, currency) }}
                </p>
              </div>
              <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-0.5">
                  Следующий
                </p>
                <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {{ formatDate(subscription.next_date) }}
                </p>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-2 pt-1">
              <UButton
                variant="secondary"
                size="sm"
                class="flex-1 hover:bg-danger/10 hover:text-danger hover:border-danger/20"
                @click="$emit('request-delete')"
              >
                <UIcon name="delete" size="xs" class="mr-1" />
                Удалить
              </UButton>
              <UButton
                variant="primary"
                size="sm"
                class="flex-1"
                @click="$emit('start-editing')"
              >
                <UIcon name="edit" size="xs" class="mr-1" />
                Изменить
              </UButton>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else class="p-4 space-y-4">
            <!-- Name & Amount Row -->
            <div class="grid grid-cols-2 gap-3">
              <UInput
                :model-value="formData.name"
                label="Название"
                placeholder="Netflix..."
               
                @update:model-value="$emit('update-field', 'name', $event as string)"
              />
              <UInput
                :model-value="String(formData.amount)"
                label="Сумма"
                placeholder="0"
                variant="currency"
                type="number"
                :suffix="currency"
                @update:model-value="$emit('update-field', 'amount', Number($event) || 0)"
              />
            </div>

            <!-- Frequency -->
            <div class="space-y-2">
              <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                Частота
              </label>
              <UTabs
                :items="frequencyTabs"
                :model-value="formData.frequency"
                @update:model-value="$emit('update-field', 'frequency', $event as SubscriptionFormData['frequency'])"
              />
            </div>

            <!-- Next Date -->
            <UInput
              :model-value="formData.next_date"
              label="Следующий платеж"
              type="date"
             
              @update:model-value="$emit('update-field', 'next_date', $event as string)"
            />

            <!-- Icon Selector -->
            <IconSelector
              :model-value="formData.icon"
              :color="formData.color"
              @update:model-value="$emit('update-field', 'icon', $event)"
            />

            <!-- Color Picker -->
            <ColorPicker
              :model-value="formData.color"
              @update:model-value="$emit('update-field', 'color', $event)"
            />

            <!-- Error -->
            <p v-if="error" class="text-xs text-danger">
              {{ error }}
            </p>

            <!-- Edit Actions -->
            <div class="flex gap-2 pt-1">
              <UButton
                variant="secondary"
                size="sm"
                class="flex-1"
                :disabled="isSubmitting"
                @click="$emit('cancel-editing')"
              >
                Отмена
              </UButton>
              <UButton
                variant="primary"
                size="sm"
                class="flex-1"
                :loading="isSubmitting"
                :disabled="!isFormValid"
                @click="$emit('save')"
              >
                Сохранить
              </UButton>
            </div>
          </div>

          <!-- Delete Confirmation -->
          <Transition name="fade">
            <div
              v-if="showDeleteConfirm"
              class="absolute inset-0 z-20 flex items-center justify-center
                     bg-card-light/95 dark:bg-card-dark/95 backdrop-blur-sm
                     rounded-t-3xl sm:rounded-2xl"
            >
              <div class="p-4 text-center max-w-xs">
                <div
                  class="w-12 h-12 mx-auto mb-3 rounded-full
                         bg-danger/10 flex items-center justify-center"
                >
                  <UIcon name="delete" size="md" class="text-danger" />
                </div>
                <h3 class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
                  Удалить подписку?
                </h3>
                <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-4">
                  "{{ subscription?.name }}" будет удалена
                </p>
                <div class="flex gap-2">
                  <UButton
                    variant="secondary"
                    size="sm"
                    class="flex-1"
                    :disabled="isDeleting"
                    @click="$emit('cancel-delete')"
                  >
                    Отмена
                  </UButton>
                  <UButton
                    variant="primary"
                    size="sm"
                    class="flex-1 !bg-danger hover:!bg-danger/90"
                    :loading="isDeleting"
                    @click="$emit('confirm-delete')"
                  >
                    Удалить
                  </UButton>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .modal-enter-from > div:last-child,
  .modal-leave-to > div:last-child {
    transform: scale(0.95) translateY(10px);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
