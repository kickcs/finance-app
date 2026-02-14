<script setup lang="ts">
import { UInput } from '@/shared/ui'
import type { AccountType } from '../model/account-types'
import type { AccountTypeFieldValues } from '../model/types'

const props = defineProps<{
  type: AccountType
  fields: AccountTypeFieldValues
}>()

const emit = defineEmits<{
  'update:field': [key: keyof AccountTypeFieldValues, value: AccountTypeFieldValues[keyof AccountTypeFieldValues]]
}>()

function updateNumber(key: keyof AccountTypeFieldValues, value: string | number) {
  emit('update:field', key, value ? Number(value) : null)
}

function updateDate(key: keyof AccountTypeFieldValues, value: string | number) {
  emit('update:field', key, (value as string) || null)
}

function updateBoolean(key: keyof AccountTypeFieldValues, value: boolean) {
  emit('update:field', key, value)
}
</script>

<template>
  <!-- Credit Card Fields -->
  <template v-if="type === 'credit_card'">
    <UInput
      :model-value="fields.creditLimit != null ? String(fields.creditLimit) : ''"
      label="Кредитный лимит"
      placeholder="0"
      type="number"
      variant="currency"
      @update:model-value="updateNumber('creditLimit', $event)"
    />
    <div class="grid grid-cols-2 gap-3">
      <UInput
        :model-value="fields.gracePeriodDays != null ? String(fields.gracePeriodDays) : ''"
        label="Грейс-период (дней)"
        placeholder="55"
        type="number"
        @update:model-value="updateNumber('gracePeriodDays', $event)"
      />
      <UInput
        :model-value="fields.billingDay != null ? String(fields.billingDay) : ''"
        label="День выписки"
        placeholder="1-31"
        type="number"
        @update:model-value="updateNumber('billingDay', $event)"
      />
    </div>
  </template>

  <!-- Loan Fields -->
  <template v-if="type === 'loan'">
    <UInput
      :model-value="fields.totalAmount != null ? String(fields.totalAmount) : ''"
      label="Сумма кредита"
      placeholder="0"
      type="number"
      variant="currency"
      @update:model-value="updateNumber('totalAmount', $event)"
    />
    <div class="grid grid-cols-2 gap-3">
      <UInput
        :model-value="fields.interestRate != null ? String(fields.interestRate) : ''"
        label="Ставка (%)"
        placeholder="12.5"
        type="number"
        @update:model-value="updateNumber('interestRate', $event)"
      />
      <UInput
        :model-value="fields.monthlyPayment != null ? String(fields.monthlyPayment) : ''"
        label="Ежемесячный платёж"
        placeholder="0"
        type="number"
        variant="currency"
        @update:model-value="updateNumber('monthlyPayment', $event)"
      />
    </div>
    <div class="grid grid-cols-2 gap-3">
      <UInput
        :model-value="fields.startDate ?? ''"
        label="Дата начала"
        type="date"
        @update:model-value="updateDate('startDate', $event)"
      />
      <UInput
        :model-value="fields.endDate ?? ''"
        label="Дата окончания"
        type="date"
        @update:model-value="updateDate('endDate', $event)"
      />
    </div>
  </template>

  <!-- Deposit Fields -->
  <template v-if="type === 'deposit'">
    <UInput
      :model-value="fields.interestRate != null ? String(fields.interestRate) : ''"
      label="Ставка (%)"
      placeholder="12.5"
      type="number"
      @update:model-value="updateNumber('interestRate', $event)"
    />
    <UInput
      :model-value="fields.maturityDate ?? ''"
      label="Дата окончания вклада"
      type="date"
      @update:model-value="updateDate('maturityDate', $event)"
    />
    <div class="flex gap-4">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          :checked="fields.isReplenishable === true"
          class="w-4 h-4 rounded border-border-light dark:border-border-dark text-primary focus:ring-primary"
          @change="updateBoolean('isReplenishable', ($event.target as HTMLInputElement).checked)"
        >
        <span class="text-sm text-text-primary-light dark:text-text-primary-dark">Пополняемый</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          :checked="fields.isWithdrawable === true"
          class="w-4 h-4 rounded border-border-light dark:border-border-dark text-primary focus:ring-primary"
          @change="updateBoolean('isWithdrawable', ($event.target as HTMLInputElement).checked)"
        >
        <span class="text-sm text-text-primary-light dark:text-text-primary-dark">С возможностью снятия</span>
      </label>
    </div>
  </template>
</template>
