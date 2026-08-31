<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { UOverlay } from '@/shared/ui/overlay';
import { UButton, UIcon, UProgressBar } from '@/shared/ui';
import { AccountSelector, type AccountWithBalances } from '@/entities/account';
import {
  DebtPaymentFields,
  DebtProgressMeter,
  useDebtPaymentForm,
  getDebtSplit,
} from '@/entities/debt';
import { useAmountInput } from '@/shared/lib/hooks/useAmountInput';
import { useHaptics } from '@/shared/lib/haptics';
import { formatCurrency, getCurrencySymbol } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import type { Debt } from '@/shared/api/database.types';
import { sortDebtsByDateAsc } from '../model/sortDebts';

/**
 * Шторка «закрыть все долги человека» — тот же язык, что и у платежа по
 * одному долгу (`PaymentDrawer`): сумма-герой, три пресета, живой метр,
 * выбор счёта.
 *
 * Старая модалка показывала долги ДВАЖДЫ — сначала списком «сколько должен»,
 * потом отдельным блоком «распределение платежа», и второй блок появлялся
 * только при неполной сумме, из-за чего строки прыгали прямо во время набора.
 * Здесь список один и он же и есть предпросмотр: у каждого долга сразу видно,
 * сколько ему достанется и что с ним станет.
 */
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

const { trigger } = useHaptics();

const selectedAccountId = ref<string | null>(null);

const debtDirection = computed<'given' | 'taken'>(() =>
  props.debts[0]?.debt_type === 'given' ? 'given' : 'taken',
);

const totalDebt = computed(() => props.debts.reduce((sum, d) => sum + d.remaining_amount, 0));

/** Итоги по валютам: у человека могут быть долги в разных валютах. */
const totalsByCurrency = computed(() => {
  const map = new Map<string, number>();
  for (const debt of props.debts) {
    const currency = debt.currency || DEFAULT_CURRENCY;
    map.set(currency, (map.get(currency) || 0) + debt.remaining_amount);
  }
  return Array.from(map.entries()).map(([currency, amount]) => ({ currency, amount }));
});

const debtCurrency = computed(() => props.debts[0]?.currency || DEFAULT_CURRENCY);
const currencySymbol = computed(() => getCurrencySymbol(debtCurrency.value));
const isMixedCurrency = computed(() => totalsByCurrency.value.length > 1);
const isPrivate = computed(() => props.debts.some((d) => d.is_private));

const { paymentAmount, forgiveRemainder, excessCategoryId, isOverpayment, reset } =
  useDebtPaymentForm({
    remainingAmount: totalDebt,
    debtType: debtDirection,
  });

const {
  inputRef: hiddenInputRef,
  rawValue,
  displayAmount,
  isFocused,
  onInput,
} = useAmountInput({
  amount: () => paymentAmount.value,
  onChange: (value) => (paymentAmount.value = value),
});

/**
 * `immediate` обязателен: страница может отрендерить шторку сразу открытой, и
 * без первого прогона сумма осталась бы нулевой, а счёт — невыбранным.
 */
watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) return;
    const linkedAccountId = props.debts.find((d) => d.account_id)?.account_id;
    selectedAccountId.value = linkedAccountId || props.accounts[0]?.id || null;
    reset(totalDebt.value);
  },
  { immediate: true },
);

// --- Предпросмотр распределения (FIFO: сначала самые старые долги) ---

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
        : willForgive
          ? 'forgiven'
          : allocated > 0
            ? 'partial'
            : 'open') as 'closed' | 'forgiven' | 'partial' | 'open',
    };
  });
});

const STATUS_META = {
  closed: { label: 'Закроется', class: 'text-success' },
  forgiven: { label: 'Простится', class: 'text-warning' },
  partial: { label: 'Частично', class: 'text-primary' },
  open: { label: 'Не покрыт', class: 'text-text-tertiary-light dark:text-text-tertiary-dark' },
} as const;

const closingCount = computed(
  () =>
    debtDistribution.value.filter((d) => d.status === 'closed' || d.status === 'forgiven').length,
);

/**
 * Метр по всем долгам разом: у одной валюты суммы складываются осмысленно,
 * при разных — нет, поэтому там его не показываем.
 */
const aggregate = computed(() => {
  let total = 0;
  let paid = 0;
  let forgiven = 0;
  for (const debt of props.debts) {
    const split = getDebtSplit(debt);
    total += debt.total_amount;
    paid += split.paid;
    forgiven += split.forgiven;
  }
  return { total, paid, forgiven };
});

const paymentPart = computed(() => Math.min(paymentAmount.value, totalDebt.value));
const paidAfter = computed(() => aggregate.value.paid + paymentPart.value);
const forgivenAfter = computed(
  () =>
    aggregate.value.forgiven + (forgiveRemainder.value ? totalDebt.value - paymentPart.value : 0),
);

// --- Пресеты ---

const halfAmount = computed(() => Math.round(totalDebt.value / 2));
const isHalfActive = computed(() => paymentAmount.value === halfAmount.value);
const isAllActive = computed(
  () => paymentAmount.value === totalDebt.value && !forgiveRemainder.value,
);
const isForgiveActive = computed(() => paymentAmount.value === 0 && forgiveRemainder.value);

function presetClass(active: boolean) {
  return [
    'px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors',
    active
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark',
  ];
}

function applyHalf() {
  trigger('selection');
  forgiveRemainder.value = false;
  paymentAmount.value = halfAmount.value;
}

function applyAll() {
  trigger('selection');
  forgiveRemainder.value = false;
  paymentAmount.value = totalDebt.value;
}

function applyForgive() {
  trigger('selection');
  paymentAmount.value = 0;
  forgiveRemainder.value = true;
}

// --- Отправка ---

const isValid = computed(() => {
  if (!selectedAccountId.value || props.debts.length === 0) return false;
  if (paymentAmount.value <= 0 && !forgiveRemainder.value) return false;
  if (isOverpayment.value && !excessCategoryId.value) return false;
  return true;
});

const progressPercent = computed(() => {
  if (!props.total) return 0;
  return ((props.progress || 0) / props.total) * 100;
});

const confirmLabel = computed(() => {
  if (props.isClosing) return `Закрываем ${props.progress ?? 0} из ${props.total ?? 0}`;
  if (forgiveRemainder.value && paymentAmount.value === 0) return 'Простить все долги';
  if (paymentAmount.value >= totalDebt.value && !isMixedCurrency.value) return 'Закрыть все долги';
  if (isMixedCurrency.value) return 'Закрыть все долги';
  return `Внести ${formatCurrency(paymentAmount.value, debtCurrency.value, { showSymbol: false })}`;
});

// Гаптика по завершении: успех — если дошли до конца списка.
watch(
  () => props.isClosing,
  (closing, wasClosing) => {
    if (wasClosing && !closing && props.modelValue) {
      trigger(props.progress === props.total ? 'success' : 'error');
    }
  },
);

function setOpen(value: boolean) {
  // Пока платежи идут по одному, закрытие шторки оставило бы процесс без
  // индикатора — держим её открытой до конца.
  if (props.isClosing) return;
  emit('update:modelValue', value);
}

function confirm() {
  if (!isValid.value || !selectedAccountId.value || props.isClosing) return;
  trigger('selection');
  emit('confirm', selectedAccountId.value, {
    paymentAmount: paymentAmount.value,
    forgiveRemainder: forgiveRemainder.value,
    excessCategoryId: isOverpayment.value ? excessCategoryId.value : undefined,
  });
}
</script>

<template>
  <UOverlay
    :model-value="modelValue"
    title="Закрыть долги"
    desktop="panel"
    @update:model-value="setOpen"
  >
    <div data-testid="close-all-drawer" class="space-y-5">
      <!-- Кто и сколько долгов -->
      <div class="flex items-center justify-center gap-2">
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-medium"
          :class="
            debtDirection === 'given'
              ? 'bg-debt-given-light text-debt-given'
              : 'bg-debt-received-light text-debt-received'
          "
        >
          <UIcon name="person" size="xs" />
          {{ personName }}
        </span>
        <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ debtDirection === 'given' ? 'вам должны' : 'вы должны' }} · {{ debts.length }}
          {{ pluralize(debts.length, 'долг', 'долга', 'долгов') }}
        </span>
      </div>

      <!--
        Сумма-героем — та же раскладка, что в шторке одиночного платежа:
        скрытый input поверх нарисованной строки.
      -->
      <div v-if="!isMixedCurrency" class="flex flex-col items-center gap-1">
        <div class="relative w-full cursor-text py-1">
          <input
            ref="hiddenInputRef"
            type="text"
            inputmode="decimal"
            :value="rawValue"
            aria-label="Сумма платежа"
            data-testid="close-all-amount-input"
            class="absolute inset-0 w-full h-full opacity-0 caret-transparent cursor-text"
            @input="onInput"
            @keydown.enter.prevent
          />

          <div class="relative flex items-baseline justify-center gap-1.5 pointer-events-none">
            <span
              class="amount-value text-4xl font-semibold tabular-nums leading-none transition-colors duration-200"
              :class="
                paymentAmount
                  ? 'text-text-primary-light dark:text-text-primary-dark'
                  : 'text-text-tertiary-light dark:text-text-tertiary-dark'
              "
            >
              {{ displayAmount }}
            </span>

            <span
              class="amount-caret inline-block h-8 w-[2px] self-center rounded-full transition-opacity duration-150"
              :class="isFocused ? 'bg-primary animate-caret-blink' : 'opacity-0'"
            />

            <span
              class="text-base leading-none text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{ currencySymbol }}
            </span>
          </div>

          <div
            class="amount-underline absolute bottom-0 left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-primary transition-all duration-300 ease-out"
            :class="isFocused ? 'w-16 opacity-100' : 'w-0 opacity-0'"
          />
        </div>
      </div>

      <!--
        Разные валюты: одной суммой их не набрать — сумма платежа зафиксирована
        полным итогом, а выбор сводится к «оплатить» или «простить».
      -->
      <div v-else class="flex flex-col items-center gap-1">
        <p
          v-for="item in totalsByCurrency"
          :key="item.currency"
          class="text-2xl font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(item.amount, item.currency) }}
        </p>
      </div>

      <!-- Пресеты -->
      <div class="flex justify-center gap-2">
        <button
          v-if="!isMixedCurrency"
          type="button"
          data-testid="close-all-preset-half"
          :class="presetClass(isHalfActive)"
          @click="applyHalf"
        >
          Половина
        </button>
        <button
          type="button"
          data-testid="close-all-preset-all"
          :class="presetClass(isAllActive)"
          @click="applyAll"
        >
          Всё
        </button>
        <button
          type="button"
          data-testid="close-all-preset-forgive"
          :class="presetClass(isForgiveActive)"
          @click="applyForgive"
        >
          Простить
        </button>
      </div>

      <!-- Живой предпросмотр по всем долгам сразу -->
      <DebtProgressMeter
        v-if="!isMixedCurrency"
        size="sm"
        :total="aggregate.total"
        :paid="paidAfter"
        :forgiven="forgivenAfter"
        :currency="debtCurrency"
        :hidden="isPrivate"
      />

      <!--
        Список долгов и есть распределение: сумма слева — что достанется долгу,
        подпись справа — что с ним станет.
      -->
      <div class="space-y-2">
        <div class="flex items-baseline justify-between gap-2">
          <p
            class="text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
          >
            Куда пойдут деньги
          </p>
          <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
            закроется {{ closingCount }} из {{ debts.length }}
          </p>
        </div>

        <ul class="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
          <li
            v-for="item in debtDistribution"
            :key="item.debt.id"
            data-testid="close-all-debt-row"
            class="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-b-0"
            :class="item.status === 'open' && 'opacity-55'"
          >
            <span
              class="min-w-0 flex-1 truncate text-body-sm text-text-primary-light dark:text-text-primary-dark"
            >
              {{ item.debt.name }}
            </span>
            <span class="shrink-0 text-right">
              <span
                class="block text-body-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark"
              >
                {{
                  formatCurrency(
                    item.allocated + item.forgiven,
                    item.debt.currency || DEFAULT_CURRENCY,
                  )
                }}
              </span>
              <span class="block text-caption" :class="STATUS_META[item.status].class">
                {{ STATUS_META[item.status].label }}
              </span>
            </span>
          </li>
        </ul>
      </div>

      <div class="space-y-2">
        <AccountSelector
          :accounts="accounts"
          :selected-id="selectedAccountId"
          :label="debtDirection === 'given' ? 'Куда зачислить' : 'С какого счёта списать'"
          @select="selectedAccountId = $event"
        />
        <p v-if="!selectedAccountId" class="text-xs text-warning">
          Выберите счёт для проведения платежей
        </p>
      </div>

      <DebtPaymentFields
        v-model:amount="paymentAmount"
        v-model:forgive-remainder="forgiveRemainder"
        v-model:excess-category-id="excessCategoryId"
        :remaining="totalDebt"
        :currency="debtCurrency"
        :direction="debtDirection"
      >
        <template #forgive-note>
          Все долги
          <template v-if="isMixedCurrency">
            (
            <span v-for="(item, i) in totalsByCurrency" :key="item.currency">
              <span class="font-semibold">{{ formatCurrency(item.amount, item.currency) }}</span>
              <template v-if="i < totalsByCurrency.length - 1">+</template>
            </span>
            )
          </template>
          <template v-else>
            на сумму
            <span class="font-semibold">{{ formatCurrency(totalDebt, debtCurrency) }}</span>
          </template>
          будут прощены и списаны как подарок.
        </template>
      </DebtPaymentFields>
    </div>

    <template #footer>
      <div class="space-y-2">
        <!-- Платежи проводятся по одному, поэтому прогресс — это реальные
             проведённые транзакции, а не анимация ожидания. -->
        <UProgressBar v-if="isClosing" :value="progressPercent" color="primary" size="sm" />
        <UButton
          variant="primary"
          full-width
          data-testid="close-all-submit"
          :loading="isClosing"
          :disabled="!isValid || isClosing"
          @click="confirm"
        >
          {{ confirmLabel }}
        </UButton>
      </div>
    </template>
  </UOverlay>
</template>

<style scoped>
@keyframes caret-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
.animate-caret-blink {
  animation: caret-blink 1s step-end infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-caret-blink {
    animation: none;
  }
  .amount-value,
  .amount-underline {
    transition: none;
  }
}
</style>
