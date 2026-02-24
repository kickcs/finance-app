<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, UIcon, UInput } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { Debt } from '@/shared/api/database.types';
import type { AccountWithBalances } from '@/entities/account';

const props = defineProps<{
  modelValue: boolean;
  debt: Debt | null;
  accounts: AccountWithBalances[];
  isPaying?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [amount: number, accountId: string];
  cancel: [];
}>();

const paymentAmount = ref(0);
const selectedAccountId = ref<string | null>(null);

// Reset when modal opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.debt) {
      paymentAmount.value = props.debt.remaining_amount;
      selectedAccountId.value = props.debt.account_id;
    }
  },
);

const debtCurrency = computed(() => props.debt?.currency || 'UZS');

const isValid = computed(() => {
  if (!props.debt || !selectedAccountId.value) return false;
  return paymentAmount.value > 0 && paymentAmount.value <= props.debt.remaining_amount;
});

const paidAmount = computed(() => {
  if (!props.debt) return 0;
  return props.debt.total_amount - props.debt.remaining_amount;
});

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}

function confirm() {
  if (isValid.value && selectedAccountId.value) {
    emit('confirm', paymentAmount.value, selectedAccountId.value);
  }
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    title="Внести платёж"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="debt" class="space-y-4">
      <!-- Debt Info -->
      <div class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            {{ debt.debt_type === 'given' ? 'Вам должны' : 'Вы должны' }}
          </span>
          <span class="font-bold text-text-primary-light dark:text-text-primary-dark">
            {{ debt.person_name || debt.name }}
          </span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Осталось
          </span>
          <span class="font-bold text-lg text-text-primary-light dark:text-text-primary-dark">
            {{ formatCurrency(debt.remaining_amount, debtCurrency) }}
          </span>
        </div>
        <div v-if="paidAmount > 0" class="flex justify-between items-center mt-1">
          <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            Уже выплачено
          </span>
          <span class="text-xs text-success">
            {{ formatCurrency(paidAmount, debtCurrency) }}
          </span>
        </div>
      </div>

      <!-- Payment Amount Input -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Сумма платежа
        </label>
        <UInput
          v-model="paymentAmount"
          type="number"
          :placeholder="`До ${debt.remaining_amount}`"
          variant="currency"
        />
      </div>

      <!-- Quick Amount Buttons -->
      <div class="flex gap-2">
        <UButton
          variant="secondary"
          size="sm"
          @click="paymentAmount = Math.round(debt.remaining_amount / 2)"
        >
          50%
        </UButton>
        <UButton variant="secondary" size="sm" @click="paymentAmount = debt.remaining_amount">
          Полностью
        </UButton>
      </div>

      <!-- Account Selection -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          {{ debt.debt_type === 'given' ? 'Куда зачислить' : 'С какого счёта списать' }}
        </label>
        <div v-if="accounts.length > 0" class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <button
            v-for="account in accounts"
            :key="account.id"
            type="button"
            class="flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap transition-all border shrink-0"
            :class="
              selectedAccountId === account.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark'
            "
            @click="selectedAccountId = account.id"
          >
            <span
              class="w-3 h-3 rounded-full shrink-0"
              :style="{ backgroundColor: account.color }"
            />
            <span class="text-sm font-medium">{{ account.name }}</span>
          </button>
        </div>
        <p
          v-if="!selectedAccountId"
          class="text-xs text-warning"
        >
          Выберите счёт для проведения платежа
        </p>
      </div>

      <!-- Info Message -->
      <div class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
        <div class="flex items-start gap-3">
          <UIcon
            name="info"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5 shrink-0"
          />
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            {{
              debt.debt_type === 'given'
                ? 'Сумма платежа будет зачислена на выбранный счёт.'
                : 'Сумма платежа будет списана с выбранного счёта.'
            }}
          </p>
        </div>
      </div>
    </div>

    <template #actions>
      <UButton variant="secondary" full-width @click="close">Отмена</UButton>
      <UButton
        variant="primary"
        full-width
        :loading="isPaying"
        :disabled="!isValid"
        @click="confirm"
      >
        Внести платёж
      </UButton>
    </template>
  </UModal>
</template>
