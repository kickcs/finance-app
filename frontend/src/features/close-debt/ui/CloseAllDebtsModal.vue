<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, UIcon, UInput, UProgressBar } from '@/shared/ui';
import { CategoryChips, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/entities/category';
import { formatCurrency } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { AccountSelector, type AccountWithBalances } from '@/entities/account';
import type { Debt } from '@/shared/api/database.types';
import { sortDebtsByDateAsc } from '../model/sortDebts';

const props = defineProps<{
  modelValue: boolean;
  debts: Debt[];
  personName: string;
  accounts: AccountWithBalances[];
  isClosing?: boolean;
  progress?: number;
  total?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [
    accountId: string,
    options: {
      paymentAmount: number;
      forgiveRemainder?: boolean;
      excessCategoryId?: string;
    },
  ];
}>();

const selectedAccountId = ref<string | null>(null);
const paymentAmount = ref(0);
const forgiveRemainder = ref(false);
const excessCategoryId = ref('gifts_income');

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      const linkedAccountId = props.debts.find((d) => d.account_id)?.account_id;
      selectedAccountId.value = linkedAccountId || props.accounts[0]?.id || null;
      paymentAmount.value = totalDebt.value;
      forgiveRemainder.value = false;
      excessCategoryId.value = debtDirection.value === 'given' ? 'gifts_income' : 'gifts';
    }
  },
);

// Group totals by currency
const totalsByCurrency = computed(() => {
  const map = new Map<string, number>();
  for (const debt of props.debts) {
    const currency = debt.currency || 'UZS';
    map.set(currency, (map.get(currency) || 0) + debt.remaining_amount);
  }
  return Array.from(map.entries()).map(([currency, amount]) => ({ currency, amount }));
});

const debtDirection = computed(() => {
  return props.debts[0]?.debt_type === 'given' ? 'given' : 'taken';
});

const totalDebt = computed(() => {
  return props.debts.reduce((sum, d) => sum + d.remaining_amount, 0);
});

const debtCurrency = computed(() => props.debts[0]?.currency || 'UZS');

const excess = computed(() => Math.max(0, paymentAmount.value - totalDebt.value));
const isOverpayment = computed(() => excess.value > 0);
const remainder = computed(() => Math.max(0, totalDebt.value - paymentAmount.value));

const excessCategories = computed(() => {
  return debtDirection.value === 'given' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
});

// FIFO distribution preview
const debtDistribution = computed(() => {
  const sorted = sortDebtsByDateAsc(props.debts);
  let budget = paymentAmount.value;
  return sorted.map((debt) => {
    const allocated = Math.min(budget, debt.remaining_amount);
    budget -= allocated;
    const willForgive = forgiveRemainder.value && allocated < debt.remaining_amount;
    return {
      debt,
      allocated,
      forgiven: willForgive ? debt.remaining_amount - allocated : 0,
      status: (allocated >= debt.remaining_amount
        ? 'closed'
        : allocated > 0 || willForgive
          ? 'partial'
          : 'open') as 'closed' | 'partial' | 'open',
    };
  });
});

// Disable forgiveness toggle when overpaying
watch(isOverpayment, (over) => {
  if (over) forgiveRemainder.value = false;
});

const isValid = computed(() => {
  if (!selectedAccountId.value || props.debts.length === 0) return false;
  if (paymentAmount.value <= 0 && !forgiveRemainder.value) return false;
  if (isOverpayment.value && !excessCategoryId.value) return false;
  return true;
});

const progressPercent = computed(() => {
  if (!props.total || props.total === 0) return 0;
  return ((props.progress || 0) / props.total) * 100;
});

const accountLabel = computed(() => {
  return debtDirection.value === 'given' ? 'Куда зачислить' : 'С какого счёта списать';
});

const confirmLabel = computed(() => {
  if (paymentAmount.value === 0 && forgiveRemainder.value) return 'Простить все';
  if (forgiveRemainder.value) return 'Оплатить и простить';
  return 'Закрыть все';
});

function close() {
  if (!props.isClosing) {
    emit('update:modelValue', false);
  }
}

function confirm() {
  if (isValid.value && selectedAccountId.value) {
    emit('confirm', selectedAccountId.value, {
      paymentAmount: paymentAmount.value,
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
    :title="`Закрыть все долги — ${personName}`"
    @update:model-value="close"
  >
    <div class="space-y-4">
      <!-- Progress state -->
      <div v-if="isClosing" class="space-y-3">
        <div class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <UIcon name="refresh" size="sm" class="text-primary animate-spin" />
            </div>
            <div>
              <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                Закрываем долги...
              </p>
              <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {{ progress }} из {{ total }}
              </p>
            </div>
          </div>
          <UProgressBar :value="progressPercent" color="primary" size="sm" />
        </div>
      </div>

      <!-- Normal state -->
      <template v-else>
        <!-- Debts summary -->
        <div class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark space-y-3">
          <div class="flex items-center gap-2 mb-1">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center"
              :class="debtDirection === 'given' ? 'bg-debt-given-light' : 'bg-debt-received-light'"
            >
              <UIcon
                name="person"
                size="sm"
                :class="debtDirection === 'given' ? 'text-debt-given' : 'text-debt-received'"
              />
            </div>
            <div>
              <p class="font-semibold text-text-primary-light dark:text-text-primary-dark">
                {{ personName }}
              </p>
              <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {{ debtDirection === 'given' ? 'Вам должны' : 'Вы должны' }}
                · {{ debts.length }} {{ pluralize(debts.length, 'долг', 'долга', 'долгов') }}
              </p>
            </div>
          </div>

          <!-- Individual debts -->
          <div class="space-y-2 pt-2 border-t border-border-light dark:border-border-dark">
            <div v-for="debt in debts" :key="debt.id" class="flex items-center justify-between">
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark truncate mr-2"
              >
                {{ debt.name }}
              </span>
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark whitespace-nowrap"
              >
                {{ formatCurrency(debt.remaining_amount, debt.currency || 'UZS') }}
              </span>
            </div>
          </div>

          <!-- Total -->
          <div class="pt-2 border-t border-border-light dark:border-border-dark">
            <div
              v-for="item in totalsByCurrency"
              :key="item.currency"
              class="flex items-center justify-between"
            >
              <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                Итого
              </span>
              <span
                class="text-base font-bold"
                :class="debtDirection === 'given' ? 'text-debt-given' : 'text-debt-received'"
              >
                {{ formatCurrency(item.amount, item.currency) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Payment Amount Input -->
        <div class="space-y-2">
          <label
            class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
          >
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
          <UButton variant="secondary" size="sm" @click="paymentAmount = Math.round(totalDebt / 2)">
            50%
          </UButton>
          <UButton variant="secondary" size="sm" @click="paymentAmount = totalDebt">
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
                {{ debtDirection === 'given' ? 'отдельный доход' : 'отдельный расход' }}.
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

        <!-- Forgiveness Toggle (only when amount < total and not overpaying) -->
        <div v-if="!isOverpayment && paymentAmount < totalDebt" class="space-y-2">
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
                {{ formatCurrency(remainder, debtCurrency) }} будет списано как подарок
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
              Все долги на сумму
              <span class="font-semibold">
                {{ formatCurrency(totalDebt, debtCurrency) }}
              </span>
              будут прощены и списаны как подарок.
            </p>
          </div>
        </div>

        <!-- Distribution Preview (when amount differs from total) -->
        <div
          v-if="paymentAmount !== totalDebt && paymentAmount > 0"
          class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark space-y-2"
        >
          <p
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2"
          >
            Распределение платежа
          </p>
          <div
            v-for="item in debtDistribution"
            :key="item.debt.id"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-text-secondary-light dark:text-text-secondary-dark truncate mr-2">
              {{ item.debt.name }}
            </span>
            <div class="flex items-center gap-2 whitespace-nowrap">
              <span
                v-if="item.allocated > 0"
                class="font-medium"
                :class="
                  item.status === 'closed'
                    ? 'text-success'
                    : 'text-text-primary-light dark:text-text-primary-dark'
                "
              >
                {{ formatCurrency(item.allocated, item.debt.currency || 'UZS') }}
              </span>
              <span v-if="item.forgiven > 0" class="text-xs text-warning">
                + {{ formatCurrency(item.forgiven, item.debt.currency || 'UZS') }} прощено
              </span>
              <span
                v-if="item.allocated === 0 && item.forgiven === 0"
                class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
              >
                не покрыт
              </span>
            </div>
          </div>
        </div>

        <!-- Account Selection -->
        <AccountSelector
          :accounts="accounts"
          :selected-id="selectedAccountId"
          :label="accountLabel"
          @select="selectedAccountId = $event"
        />

        <!-- Info -->
        <div class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
          <div class="flex items-start gap-3">
            <UIcon
              name="info"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5 shrink-0"
            />
            <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Для каждого долга будет создана транзакция
              {{ debtDirection === 'given' ? 'зачисления' : 'списания' }}
              на выбранный счёт.
            </p>
          </div>
        </div>
      </template>
    </div>

    <template #actions>
      <template v-if="!isClosing">
        <UButton variant="secondary" full-width @click="close">Отмена</UButton>
        <UButton variant="primary" full-width :disabled="!isValid" @click="confirm">
          {{ confirmLabel }}
        </UButton>
      </template>
    </template>
  </UModal>
</template>
