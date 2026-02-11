<script setup lang="ts">
import { UInput, UButton } from '@/shared/ui'
import IconSelector from './IconSelector.vue'
import ColorPicker from './ColorPicker.vue'
import CurrencyBalanceList from './CurrencyBalanceList.vue'
import type { AccountFormData } from '../model/useCreateAccount'

const props = defineProps<{
  formData: AccountFormData
  isSubmitting?: boolean
  error?: string | null
  nameError?: string | null
}>()

const emit = defineEmits<{
  'update:formData': [value: AccountFormData]
  submit: []
  addCurrency: [currency: string]
  removeCurrency: [index: number]
  updateBalance: [index: number, balance: number]
  updateCurrency: [index: number, currency: string]
}>()

function updateField<K extends keyof AccountFormData>(field: K, value: AccountFormData[K]) {
  emit('update:formData', { ...props.formData, [field]: value })
}
</script>

<template>
  <form
    class="space-y-6 transition-opacity duration-200"
    :class="isSubmitting && 'opacity-60 pointer-events-none'"
    @submit.prevent="$emit('submit')"
  >
    <!-- Account Name -->
    <UInput
      :model-value="formData.name"
      label="Название счёта"
      placeholder="Например: Основная карта"
     
      :error="nameError ?? undefined"
      @update:model-value="updateField('name', $event as string)"
    />

    <!-- Currency Balances -->
    <CurrencyBalanceList
      :balances="formData.balances"
      @add="$emit('addCurrency', $event)"
      @remove="$emit('removeCurrency', $event)"
      @update-balance="(index, balance) => $emit('updateBalance', index, balance)"
      @update-currency="(index, currency) => $emit('updateCurrency', index, currency)"
    />

    <!-- Icon Selector -->
    <IconSelector
      :model-value="formData.icon"
      :color="formData.color"
      @update:model-value="updateField('icon', $event)"
    />

    <!-- Color Picker -->
    <ColorPicker
      :model-value="formData.color"
      @update:model-value="updateField('color', $event)"
    />

    <!-- Error Message -->
    <p v-if="error" class="text-sm text-danger">
      {{ error }}
    </p>

    <!-- Submit Button -->
    <UButton
      type="submit"
      variant="primary"
      size="xl"
      full-width
      :loading="isSubmitting"
      :disabled="!formData.name.trim() || formData.balances.length === 0"
    >
      Создать счёт
    </UButton>
  </form>
</template>
