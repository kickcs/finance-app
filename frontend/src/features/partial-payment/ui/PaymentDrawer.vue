<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { UOverlay } from '@/shared/ui/overlay';
import { UButton } from '@/shared/ui';
import { AccountSelector, type AccountWithBalances } from '@/entities/account';
import {
  DebtProgressMeter,
  DebtPaymentFields,
  useDebtPaymentForm,
  getDebtSplit,
} from '@/entities/debt';
import { useAmountInput } from '@/shared/lib/hooks/useAmountInput';
import { useHaptics } from '@/shared/lib/haptics';
import { formatCurrency, getCurrencySymbol } from '@/shared/lib/format/currency';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import type { Debt } from '@/shared/api/database.types';
import type { DebtPaymentSubmit } from '../model/useDebtPaymentFlow';

/**
 * Шторка платежа по долгу — сумма и есть интерфейс: восемь блоков и два
 * дублирующих инфо-блока старой модалки схлопнуты в героя-сумму, три пресета
 * и живой предпросмотр `DebtProgressMeter`. Остаток и погашенное теперь
 * показывает метр, а направление денег — подпись у выбора счёта.
 */
const props = defineProps<{
  modelValue: boolean;
  debt: Debt | null;
  accounts: AccountWithBalances[];
  /** Значения неудавшегося платежа: шторка открывается заново уже заполненной. */
  draft?: DebtPaymentSubmit | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  confirm: [payload: DebtPaymentSubmit];
}>();

const { trigger } = useHaptics();

const selectedAccountId = ref<string | null>(null);

const debtCurrency = computed(() => props.debt?.currency || DEFAULT_CURRENCY);
const currencySymbol = computed(() => getCurrencySymbol(debtCurrency.value));
const debtDirection = computed<'given' | 'taken'>(() =>
  props.debt?.debt_type === 'given' ? 'given' : 'taken',
);
const remaining = computed(() => props.debt?.remaining_amount ?? 0);

const { paymentAmount, forgiveRemainder, excessCategoryId, isOverpayment, reset } =
  useDebtPaymentForm({
    remainingAmount: remaining,
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
 * `reset()` всегда выставляет верные дефолты (сумма = остаток, категория
 * переплаты по направлению долга) — черновик неудавшегося платежа накатывается
 * поверх, а не вместо: иначе категория переплаты осталась бы дефолтной, если
 * в черновике её не было (переплаты не было).
 */
watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen || !props.debt) return;
    reset(props.debt.remaining_amount);
    if (props.draft) {
      paymentAmount.value = props.draft.amount;
      selectedAccountId.value = props.draft.accountId;
      forgiveRemainder.value = props.draft.forgiveRemainder ?? false;
      if (props.draft.excessCategoryId) excessCategoryId.value = props.draft.excessCategoryId;
    } else {
      selectedAccountId.value = props.debt.account_id ?? props.accounts[0]?.id ?? null;
    }
  },
);

const isValid = computed(() => {
  if (!props.debt || !selectedAccountId.value) return false;
  if (paymentAmount.value <= 0 && !forgiveRemainder.value) return false;
  if (isOverpayment.value && !excessCategoryId.value) return false;
  return true;
});

const halfAmount = computed(() => Math.round(remaining.value / 2));
const isHalfActive = computed(() => paymentAmount.value === halfAmount.value);
const isAllActive = computed(() => paymentAmount.value === remaining.value);
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
  paymentAmount.value = halfAmount.value;
}

function applyAll() {
  trigger('selection');
  paymentAmount.value = remaining.value;
}

function applyForgive() {
  trigger('selection');
  paymentAmount.value = 0;
  forgiveRemainder.value = true;
}

// Предпросмотр метра: что станет с долгом, если подтвердить прямо сейчас.
const split = computed(() => (props.debt ? getDebtSplit(props.debt) : null));
const paymentPart = computed(() => Math.min(paymentAmount.value, remaining.value));

const paidAfter = computed(() => (split.value?.paid ?? 0) + paymentPart.value);
const forgivenAfter = computed(() => {
  if (!split.value) return 0;
  const willForgive = forgiveRemainder.value ? remaining.value - paymentPart.value : 0;
  return split.value.forgiven + willForgive;
});

const confirmLabel = computed(() => {
  if (forgiveRemainder.value && paymentAmount.value === 0) return 'Простить долг';
  if (paymentAmount.value >= remaining.value) return 'Закрыть долг';
  return `Внести ${formatCurrency(paymentAmount.value, debtCurrency.value, { showSymbol: false })}`;
});

function confirm() {
  if (!isValid.value || !selectedAccountId.value) return;
  trigger('selection');
  emit('confirm', {
    amount: paymentAmount.value,
    accountId: selectedAccountId.value,
    forgiveRemainder: forgiveRemainder.value,
    excessCategoryId: isOverpayment.value ? excessCategoryId.value : undefined,
  });
}
</script>

<template>
  <UOverlay
    :model-value="modelValue"
    title="Внести платёж"
    desktop="panel"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="debt" data-testid="payment-drawer" class="space-y-5">
      <!--
        Сумма-героем: скрытый input поверх нарисованной строки, как в
        HeroAmount/AmountHeadline — но без импорта feature→feature, поэтому
        минимальная вёрстка собрана прямо здесь.
      -->
      <div class="flex flex-col items-center gap-1">
        <div class="relative w-full cursor-text py-1">
          <input
            ref="hiddenInputRef"
            type="text"
            inputmode="decimal"
            :value="rawValue"
            aria-label="Сумма платежа"
            data-testid="payment-amount-input"
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

      <!-- Пресеты -->
      <div class="flex justify-center gap-2">
        <button
          type="button"
          data-testid="preset-half"
          :class="presetClass(isHalfActive)"
          @click="applyHalf"
        >
          Половина
        </button>
        <button
          type="button"
          data-testid="preset-all"
          :class="presetClass(isAllActive)"
          @click="applyAll"
        >
          Всё
        </button>
        <button
          type="button"
          data-testid="preset-forgive"
          :class="presetClass(isForgiveActive)"
          @click="applyForgive"
        >
          Простить
        </button>
      </div>

      <!-- Живой предпросмотр: полоса двигается прямо во время набора суммы -->
      <DebtProgressMeter
        size="sm"
        :total="debt.total_amount"
        :paid="paidAfter"
        :forgiven="forgivenAfter"
        :currency="debtCurrency"
        :hidden="debt.is_private"
      />

      <div class="space-y-2">
        <AccountSelector
          :accounts="accounts"
          :selected-id="selectedAccountId"
          :label="debtDirection === 'given' ? 'Куда зачислить' : 'С какого счёта списать'"
          @select="selectedAccountId = $event"
        />
        <!-- Без счёта кнопка заблокирована — молчаливый тупик, если у долга
             нет привязанного счёта, а список счетов на момент открытия пуст -->
        <p v-if="!selectedAccountId" class="text-xs text-warning">
          Выберите счёт для проведения платежа
        </p>
      </div>

      <DebtPaymentFields
        v-model:amount="paymentAmount"
        v-model:forgive-remainder="forgiveRemainder"
        v-model:excess-category-id="excessCategoryId"
        :remaining="remaining"
        :currency="debtCurrency"
        :direction="debtDirection"
      />
    </div>

    <template #footer>
      <UButton
        variant="primary"
        full-width
        data-testid="payment-drawer-submit"
        :disabled="!isValid"
        @click="confirm"
      >
        {{ confirmLabel }}
      </UButton>
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
