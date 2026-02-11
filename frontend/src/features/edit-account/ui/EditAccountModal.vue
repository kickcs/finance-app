<script setup lang="ts">
import { ref, watch } from 'vue'
import { UModal, UInput, UButton, UTabs } from '@/shared/ui'
import { IconSelector, ColorPicker } from '@/features/create-account'
import type { Account, AccountWithBalances } from '@/shared/api/database.types'

const props = defineProps<{
  modelValue: boolean
  account: Account | AccountWithBalances | null
  isUpdating?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [updates: Partial<Account>]
  cancel: []
}>()

// Local form state
const name = ref('')
const icon = ref('')
const color = ref('')
const type = ref<'basic' | 'savings'>('basic')

// Sync form state with account prop
watch(
  () => props.account,
  (a) => {
    if (a) {
      name.value = a.name
      icon.value = a.icon
      color.value = a.color
      type.value = a.type as 'basic' | 'savings'
    }
  },
  { immediate: true }
)

const typeTabs = [
  { id: 'basic', label: 'Основной' },
  { id: 'savings', label: 'Накопительный' },
]

function close() {
  emit('update:modelValue', false)
  emit('cancel')
}

function confirm() {
  emit('confirm', {
    name: name.value.trim(),
    icon: icon.value,
    color: color.value,
    type: type.value,
  })
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    title="Редактировать счёт"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="account" class="space-y-5">
      <!-- Name -->
      <UInput
        v-model="name"
        label="Название"
        placeholder="Наличные, Карта..."
       
      />

      <!-- Type -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Тип счёта
        </label>
        <UTabs
          v-model="type"
          :items="typeTabs"
        />
      </div>

      <!-- Icon -->
      <IconSelector
        v-model="icon"
        :color="color"
      />

      <!-- Color -->
      <ColorPicker v-model="color" />
    </div>

    <template #actions>
      <UButton variant="secondary" full-width @click="close">
        Отмена
      </UButton>
      <UButton
        variant="primary"
        full-width
        :loading="isUpdating"
        :disabled="!name.trim()"
        @click="confirm"
      >
        Сохранить
      </UButton>
    </template>
  </UModal>
</template>
