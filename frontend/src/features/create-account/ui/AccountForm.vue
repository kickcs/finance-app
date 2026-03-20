<script setup lang="ts">
import { UInput, UButton, UColorPicker, UIconSelector } from '@/shared/ui';
import CurrencyBalanceList from './CurrencyBalanceList.vue';
import type { AccountFormData } from '../model/useCreateAccount';
import {
  VISIBLE_ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  AccountTypeFields,
  ACCOUNT_ICONS,
} from '@/entities/account';
import { ENTITY_COLORS } from '@/shared/config/colors';
import type { AccountType } from '@/entities/account';

const props = defineProps<{
  formData: AccountFormData;
  isSubmitting?: boolean;
  error?: string | null;
  nameError?: string | null;
}>();

const emit = defineEmits<{
  'update:formData': [value: AccountFormData];
  submit: [];
  addCurrency: [currency: string];
  removeCurrency: [index: number];
  updateBalance: [index: number, balance: number];
  updateCurrency: [index: number, currency: string];
}>();

function updateField<K extends keyof AccountFormData>(field: K, value: AccountFormData[K]) {
  emit('update:formData', { ...props.formData, [field]: value });
}
</script>

<template>
  <form
    data-testid="account-form"
    class="space-y-6 transition-opacity duration-200"
    :class="isSubmitting && 'opacity-60 pointer-events-none'"
    @submit.prevent="$emit('submit')"
  >
    <!-- Account Name -->
    <UInput
      data-testid="account-name-input"
      :model-value="formData.name"
      label="Название счёта"
      placeholder="Например: Основная карта"
      :error="nameError ?? undefined"
      @update:model-value="updateField('name', $event as string)"
    />

    <!-- Account Type -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Тип счёта
      </label>
      <div class="grid grid-cols-2 gap-2" data-testid="account-type-selector">
        <button
          v-for="t in VISIBLE_ACCOUNT_TYPES"
          :key="t"
          type="button"
          :data-testid="`account-type-${t}`"
          :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 border',
            formData.type === t
              ? 'bg-primary text-white border-primary'
              : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border-border-light dark:border-border-dark hover:border-primary/50',
          ]"
          @click="updateField('type', t as AccountType)"
        >
          {{ ACCOUNT_TYPE_LABELS[t] }}
        </button>
      </div>
    </div>

    <!-- Type-specific Fields -->
    <AccountTypeFields
      :type="formData.type"
      :fields="formData"
      @update:field="(key, value) => updateField(key as keyof AccountFormData, value as any)"
    />

    <!-- Currency Balances -->
    <CurrencyBalanceList
      :balances="formData.balances"
      :label="formData.type === 'credit_card' ? 'Текущая задолженность' : undefined"
      :hint="formData.type === 'credit_card' ? 'Введите 0, если задолженности нет' : undefined"
      @add="$emit('addCurrency', $event)"
      @remove="$emit('removeCurrency', $event)"
      @update-balance="(index, balance) => $emit('updateBalance', index, balance)"
      @update-currency="(index, currency) => $emit('updateCurrency', index, currency)"
    />

    <!-- Icon Selector -->
    <UIconSelector
      :model-value="formData.icon"
      :icons="ACCOUNT_ICONS"
      :color="formData.color"
      label="Иконка"
      @update:model-value="updateField('icon', $event)"
    />

    <!-- Color Picker -->
    <UColorPicker
      :model-value="formData.color"
      :colors="ENTITY_COLORS"
      label="Цвет"
      @update:model-value="updateField('color', $event)"
    />

    <!-- Error Message -->
    <p v-if="error" data-testid="form-error" class="text-sm text-danger">
      {{ error }}
    </p>

    <!-- Submit Button -->
    <UButton
      data-testid="submit-btn"
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
