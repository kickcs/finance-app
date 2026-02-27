<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, UIcon, UInput } from '@/shared/ui';
import { CategoryChips, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/entities/category';
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
  confirm: [
    amount: number,
    accountId: string,
    options: { forgiveRemainder?: boolean; excessCategoryId?: string },
  ];
  cancel: [];
}>();

const paymentAmount = ref(0);
const selectedAccountId = ref<string | null>(null);
const forgiveRemainder = ref(false);
const excessCategoryId = ref('gifts_income');

// Reset when modal opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.debt) {
      paymentAmount.value = props.debt.remaining_amount;
      selectedAccountId.value = props.debt.account_id;
      forgiveRemainder.value = false;
      excessCategoryId.value = props.debt.debt_type === 'given' ? 'gifts_income' : 'gifts';
    }
  },
);

const debtCurrency = computed(() => props.debt?.currency || 'UZS');

const excess = computed(() => {
  if (!props.debt) return 0;
  return Math.max(0, paymentAmount.value - props.debt.remaining_amount);
});

const isOverpayment = computed(() => excess.value > 0);

const isValid = computed(() => {
  if (!props.debt || !selectedAccountId.value) return false;
  if (paymentAmount.value <= 0 && !forgiveRemainder.value) return false;
  if (isOverpayment.value && !excessCategoryId.value) return false;
  return true;
});

const paidAmount = computed(() => {
  if (!props.debt) return 0;
  return props.debt.total_amount - props.debt.remaining_amount;
});

const excessCategories = computed(() => {
  if (!props.debt) return INCOME_CATEGORIES;
  return props.debt.debt_type === 'given' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
});

// Disable forgiveness toggle when overpaying
watch(isOverpayment, (over) => {
  if (over) forgiveRemainder.value = false;
});

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}

function confirm() {
  if (isValid.value && selectedAccountId.value) {
    emit('confirm', paymentAmount.value, selectedAccountId.value, {
      forgiveRemainder: forgiveRemainder.value,
      excessCategoryId: isOverpayment.value ? excessCategoryId.value : undefined,
    });
  }
}

function setForgiveOnly() {
  paymentAmount.value = 0;
  forgiveRemainder.value = true;
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
          placeholder="Введите сумму"
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
        <UButton variant="secondary" size="sm" @click="setForgiveOnly">
          <UIcon name="volunteer_activism" size="xs" class="mr-1" />
          Простить
        </UButton>
      </div>

      <!-- Overpayment Info & Category Selector -->
      <div v-if="isOverpayment" class="space-y-3">
        <div class="p-3 rounded-xl bg-primary/5 border border-primary/20">
          <div class="flex items-start gap-2">
            <UIcon name="info" size="sm" class="text-primary mt-0.5 shrink-0" />
            <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Сумма превышает долг на
              <span class="font-semibold text-primary">
                {{ formatCurrency(excess, debtCurrency) }}
              </span>
              . Разница будет записана как
              {{ debt.debt_type === 'given' ? 'отдельный доход' : 'отдельный расход' }}.
            </p>
          </div>
        </div>
        <CategoryChips
          :categories="excessCategories"
          :selected-id="excessCategoryId"
          label="Категория переплаты"
          @select="excessCategoryId = $event"
        />
      </div>

      <!-- Forgiveness Toggle (only when amount < remaining) -->
      <div v-if="!isOverpayment && paymentAmount < debt.remaining_amount" class="space-y-2">
        <button
          type="button"
          class="flex items-center gap-3 w-full p-3 rounded-xl transition-colors"
          :class="
            forgiveRemainder
              ? 'bg-primary/5 border border-primary/20'
              : 'bg-surface-light dark:bg-surface-dark border border-transparent'
          "
          @click="forgiveRemainder = !forgiveRemainder"
        >
          <div
            class="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0"
            :class="
              forgiveRemainder
                ? 'bg-primary border-primary'
                : 'border-gray-300 dark:border-gray-600'
            "
          >
            <UIcon v-if="forgiveRemainder" name="check" size="xs" class="text-white" />
          </div>
          <div class="flex-1 text-left">
            <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              Простить остаток
            </p>
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              {{ formatCurrency(debt.remaining_amount - paymentAmount, debtCurrency) }} будет
              списано как подарок
            </p>
          </div>
          <UIcon
            name="volunteer_activism"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
          />
        </button>
      </div>

      <!-- Forgiveness-only info (when amount = 0 and forgiving) -->
      <div
        v-if="paymentAmount === 0 && forgiveRemainder"
        class="p-3 rounded-xl bg-warning/5 border border-warning/20"
      >
        <div class="flex items-start gap-2">
          <UIcon name="volunteer_activism" size="sm" class="text-warning mt-0.5 shrink-0" />
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Весь долг
            <span class="font-semibold">
              {{ formatCurrency(debt.remaining_amount, debtCurrency) }}
            </span>
            будет прощён и списан как подарок.
          </p>
        </div>
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
        <p v-if="!selectedAccountId" class="text-xs text-warning">
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
        {{ forgiveRemainder && paymentAmount === 0 ? 'Простить долг' : 'Внести платёж' }}
      </UButton>
    </template>
  </UModal>
</template>
