<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UInput, UButton, UColorPicker, UIconSelector } from '@/shared/ui';
import {
  VISIBLE_ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  AccountTypeFields,
  ACCOUNT_ICONS,
} from '@/entities/account';
import { ENTITY_COLORS } from '@/shared/config/colors';
import type { AccountType, AccountTypeFieldValues } from '@/entities/account';
import type { Account, AccountWithBalances } from '@/shared/api/database.types';

const props = defineProps<{
  modelValue: boolean;
  account: Account | AccountWithBalances | null;
  isUpdating?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [updates: Partial<Account>];
  cancel: [];
}>();

// Local form state
const name = ref('');
const icon = ref('');
const color = ref('');
const type = ref<AccountType>('basic');

// Type-specific fields
const creditLimit = ref<number | null>(null);
const gracePeriodDays = ref<number | null>(null);
const billingDay = ref<number | null>(null);
const totalAmount = ref<number | null>(null);
const interestRate = ref<number | null>(null);
const monthlyPayment = ref<number | null>(null);
const startDate = ref<string | null>(null);
const endDate = ref<string | null>(null);
const maturityDate = ref<string | null>(null);
const isReplenishable = ref<boolean | null>(null);
const isWithdrawable = ref<boolean | null>(null);

// Guard to prevent type watcher from clearing fields during initialization
let isInitializing = false;

// Sync form state with account prop
watch(
  () => props.account,
  (a) => {
    if (a) {
      isInitializing = true;
      name.value = a.name;
      icon.value = a.icon;
      color.value = a.color;
      type.value = a.type as AccountType;
      creditLimit.value = a.credit_limit;
      gracePeriodDays.value = a.grace_period_days;
      billingDay.value = a.billing_day;
      totalAmount.value = a.total_amount;
      interestRate.value = a.interest_rate;
      monthlyPayment.value = a.monthly_payment;
      startDate.value = a.start_date;
      endDate.value = a.end_date;
      maturityDate.value = a.maturity_date;
      isReplenishable.value = a.is_replenishable;
      isWithdrawable.value = a.is_withdrawable;
      isInitializing = false;
    }
  },
  { immediate: true },
);

// Clear type-specific fields when type changes (skip during initialization)
watch(type, (newType, oldType) => {
  if (newType === oldType || isInitializing) return;
  creditLimit.value = null;
  gracePeriodDays.value = null;
  billingDay.value = null;
  totalAmount.value = null;
  interestRate.value = null;
  monthlyPayment.value = null;
  startDate.value = null;
  endDate.value = null;
  maturityDate.value = null;
  isReplenishable.value = null;
  isWithdrawable.value = null;
});

const typeFields = computed<AccountTypeFieldValues>(() => ({
  creditLimit: creditLimit.value,
  gracePeriodDays: gracePeriodDays.value,
  billingDay: billingDay.value,
  totalAmount: totalAmount.value,
  interestRate: interestRate.value,
  monthlyPayment: monthlyPayment.value,
  startDate: startDate.value,
  endDate: endDate.value,
  maturityDate: maturityDate.value,
  isReplenishable: isReplenishable.value,
  isWithdrawable: isWithdrawable.value,
}));

function updateTypeField(
  key: keyof AccountTypeFieldValues,
  value: AccountTypeFieldValues[keyof AccountTypeFieldValues],
) {
  const refs: Record<keyof AccountTypeFieldValues, any> = {
    creditLimit,
    gracePeriodDays,
    billingDay,
    totalAmount,
    interestRate,
    monthlyPayment,
    startDate,
    endDate,
    maturityDate,
    isReplenishable,
    isWithdrawable,
  };
  refs[key].value = value;
}

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}

function confirm() {
  emit('confirm', {
    name: name.value.trim(),
    icon: icon.value,
    color: color.value,
    type: type.value,
    credit_limit: creditLimit.value,
    grace_period_days: gracePeriodDays.value,
    billing_day: billingDay.value,
    total_amount: totalAmount.value,
    interest_rate: interestRate.value,
    monthly_payment: monthlyPayment.value,
    start_date: startDate.value,
    end_date: endDate.value,
    maturity_date: maturityDate.value,
    is_replenishable: isReplenishable.value,
    is_withdrawable: isWithdrawable.value,
  });
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    title="Редактировать счёт"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="account" class="space-y-5" data-testid="edit-account-form">
      <!-- Name -->
      <UInput
        v-model="name"
        data-testid="account-name-input"
        label="Название"
        placeholder="Наличные, Карта..."
      />

      <!-- Type -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Тип счёта
        </label>
        <div class="grid grid-cols-3 gap-2" data-testid="account-type-selector">
          <button
            v-for="t in VISIBLE_ACCOUNT_TYPES"
            :key="t"
            type="button"
            :data-testid="`account-type-${t}`"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 border',
              type === t
                ? 'bg-primary text-white border-primary'
                : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border-border-light dark:border-border-dark hover:border-primary/50',
            ]"
            @click="type = t"
          >
            {{ ACCOUNT_TYPE_LABELS[t] }}
          </button>
        </div>
      </div>

      <!-- Type-specific Fields -->
      <AccountTypeFields :type="type" :fields="typeFields" @update:field="updateTypeField" />

      <!-- Icon -->
      <UIconSelector v-model="icon" :icons="ACCOUNT_ICONS" :color="color" label="Иконка" />

      <!-- Color -->
      <UColorPicker v-model="color" :colors="ENTITY_COLORS" label="Цвет" />
    </div>

    <template #actions>
      <UButton variant="secondary" full-width data-testid="cancel-btn" @click="close">
        Отмена
      </UButton>
      <UButton
        variant="primary"
        full-width
        data-testid="save-btn"
        :loading="isUpdating"
        :disabled="!name.trim()"
        @click="confirm"
      >
        Сохранить
      </UButton>
    </template>
  </UModal>
</template>
