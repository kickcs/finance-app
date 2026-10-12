<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { UIcon } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import { AccountPopover, type AccountWithBalances } from '@/entities/account';
import { formatCurrency } from '@/shared/lib/format/currency';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { useAmountInput } from '@/shared/lib/hooks/useAmountInput';
import PaymentPartsEditor from '@/features/payment-group/ui/PaymentPartsEditor.vue';
import type { SecondPart } from '@/features/payment-group/model/paymentParts';
import {
  secondPartCandidates,
  startSecondPart,
} from '@/features/payment-group/model/secondPartAccounts';

/**
 * Сумма операции — прямо на фоне страницы, без карточки.
 *
 * Карточка была лишним ярусом: рамка, заливка, слой тонировки и цветная полоска
 * слева — три шаблонных приёма подряд, из-за которых экран читался как
 * сгенерированный. Цвет счёта информацию по-прежнему несёт, но точкой в
 * переключателе и окраской каретки, а не заливкой площади. На вкладке «Долг»,
 * где счёт выбирается ниже и прогноза остатка нет, блок вырождается в одну
 * сумму — на голом фоне это нормально, полупустой карточкой не было.
 */
const props = defineProps<{
  amount: number;
  currency: string;
  currencySymbol: string;
  availableCurrencies: string[];
  isMultiCurrency: boolean;
  /** Счета для выбора прямо здесь — отдельный ряд чипов дублировал бы строку. */
  accounts: AccountWithBalances[];
  accountId: string | null;
  accountName?: string;
  accountColor?: string;
  /**
   * Куда движутся деньги по счёту: `minus` — прогноз остатка, `plus` — прогноз
   * пополнения, `null` — счёт выбирается ниже в форме (долг), прогноза нет.
   */
  sign: 'minus' | 'plus' | null;
  currentBalance?: number;
  showInsufficientFunds?: boolean;
  /**
   * Что уйдёт со счёта сверх суммы — комиссия за перевод при выдаче долга.
   * Без неё прогноз остатка врал бы ровно на её величину.
   */
  extraDebit?: number;
  autofocus?: boolean;
  /** Вторая часть оплаты: с ней строка остатка уступает место строкам по частям. */
  secondPart?: SecondPart | null;
  /** Оплата с двух счетов доступна (расход и доход). */
  allowSecondPart?: boolean;
}>();

const emit = defineEmits<{
  'update:amount': [value: number];
  'update:currency': [value: string];
  'update:accountId': [value: string];
  'update:secondPart': [value: SecondPart | null];
}>();

const FALLBACK_ACCENT = 'var(--color-primary)';

const inputId = useId();
const currencyOpen = ref(false);

const {
  inputRef: hiddenInputRef,
  rawValue,
  displayAmount,
  isFocused,
  onInput,
} = useAmountInput({
  amount: () => props.amount,
  autofocus: () => props.autofocus,
  onChange: (value) => emit('update:amount', value),
});

const accent = computed(() => props.accountColor || FALLBACK_ACCENT);
const caretStyle = computed(() => ({ backgroundColor: accent.value }));

// Кегль ступенями по числу значащих цифр: в UZS суммы длинные (3 068 000 —
// семь цифр), и на фиксированном кегле они упираются в край экрана.
const amountSizeClass = computed(() => {
  const digits = displayAmount.value.replace(/\D/g, '').length;
  if (digits <= 6) return 'text-[3.25rem]';
  if (digits <= 8) return 'text-[2.5rem]';
  return 'text-3xl';
});

const projectedBalance = computed(() => {
  if (props.currentBalance === undefined || !props.sign) return null;
  return props.sign === 'minus'
    ? props.currentBalance - props.amount - (props.extraDebit ?? 0)
    : props.currentBalance + props.amount;
});

/**
 * Печатаем сумму тем же символом валюты, что и в строке ввода: `Intl` для UZS
 * отдаёт код «UZS», и под «250 000 сўм» появлялось «Останется 6 848 000 UZS» —
 * две записи одной валюты подряд.
 */
function withSymbol(value: number) {
  return `${formatCurrency(value, props.currency, { showSymbol: false })} ${props.currencySymbol}`;
}

const balanceLine = computed(() => {
  if (props.currentBalance === undefined) return null;

  if (props.showInsufficientFunds && props.amount > 0) {
    return {
      tone: 'warning' as const,
      text: `Не хватает ${withSymbol(props.amount + (props.extraDebit ?? 0) - props.currentBalance)}`,
    };
  }

  if (props.amount > 0 && projectedBalance.value !== null) {
    const verb = props.sign === 'minus' ? 'Останется' : 'Станет';
    return { tone: 'muted' as const, text: `${verb} ${withSymbol(projectedBalance.value)}` };
  }

  return { tone: 'muted' as const, text: `Баланс ${withSymbol(props.currentBalance)}` };
});

// «Доплатить с другого счёта»: вторая часть = недостача; с пустого счёта первая часть вышла бы нулевой.
const shortfallPart = computed<SecondPart | null>(() => {
  if (!props.allowSecondPart || props.sign !== 'minus' || !props.showInsufficientFunds) return null;
  if (props.currentBalance === undefined || props.currentBalance <= 0 || props.amount <= 0) {
    return null;
  }
  const candidates = secondPartCandidates(props.accounts, props.accountId, props.currency);
  if (candidates.length === 0) return null;
  // Суммы с копейками: без округления 0.3 − 0.1 оставит хвост float.
  const shortfall = Math.round((props.amount - props.currentBalance) * 100) / 100;
  return startSecondPart(candidates, shortfall);
});

function selectCurrency(cur: string) {
  emit('update:currency', cur);
  currencyOpen.value = false;
}
</script>

<template>
  <div>
    <!-- Кнопка второго счёта живёт в строке счёта: отдельный ярус ради неё не нужен.
         С двумя счетами строка уходит — оба выбираются в строках частей под суммой. -->
    <div v-if="accountName && !secondPart" class="flex items-center gap-3">
      <AccountPopover
        :accounts="accounts"
        :selected-id="accountId"
        @select="emit('update:accountId', $event)"
      >
        <template #trigger>
          <button
            type="button"
            data-testid="account-trigger"
            aria-label="Выбрать счёт"
            class="account-trigger -ml-1 flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
          >
            <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: accent }" />
            <span class="truncate">{{ accountName }}</span>
            <UIcon v-if="accounts.length > 1" name="expand_more" size="xs" class="shrink-0" />
          </button>
        </template>
      </AccountPopover>
      <PaymentPartsEditor
        v-if="allowSecondPart && !secondPart"
        class="ml-auto shrink-0"
        :model-value="null"
        :accounts="accounts"
        :primary-account-id="accountId"
        :currency="currency"
        :total="amount"
        @update:model-value="emit('update:secondPart', $event)"
      />
    </div>

    <!--
      Скрытый input лежит под всей строкой, а сама строка не ловит указатель —
      тапом попадаешь в поле откуда угодно, а кнопка валюты (единственная с
      pointer-events) остаётся кликабельной.
    -->
    <div class="relative mt-1 cursor-text">
      <input
        :id="inputId"
        ref="hiddenInputRef"
        type="text"
        inputmode="decimal"
        :value="rawValue"
        aria-label="Сумма"
        data-testid="amount-input"
        class="absolute inset-0 h-full w-full cursor-text opacity-0 caret-transparent"
        @input="onInput"
        @keydown.enter.prevent
      />

      <div class="pointer-events-none flex min-h-[3.75rem] items-baseline gap-2">
        <span
          class="amount-value font-bold leading-none tracking-tight tabular-nums"
          :class="[
            amountSizeClass,
            amount
              ? 'text-text-primary-light dark:text-text-primary-dark'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark',
          ]"
        >
          {{ displayAmount }}
        </span>

        <span
          class="amount-caret inline-block w-[2px] self-center rounded-full transition-opacity duration-150"
          :class="isFocused ? 'h-10 animate-caret-blink' : 'h-10 opacity-0'"
          :style="isFocused ? caretStyle : undefined"
        />

        <Popover v-if="isMultiCurrency" v-model:open="currencyOpen">
          <PopoverTrigger as-child>
            <button
              type="button"
              aria-label="Выбрать валюту"
              class="amount-currency pointer-events-auto -my-1 inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-lg leading-none text-text-tertiary-light hover:bg-surface-light hover:text-text-primary-light dark:text-text-tertiary-dark dark:hover:bg-surface-dark dark:hover:text-text-primary-dark"
            >
              {{ currencySymbol }}
              <UIcon name="expand_more" size="xs" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" :side-offset="8" class="w-auto min-w-[140px] p-1">
            <button
              v-for="cur in availableCurrencies"
              :key="cur"
              type="button"
              :class="[
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                cur === currency
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark',
              ]"
              @click="selectCurrency(cur)"
            >
              <span>{{ getCurrencyByCode(cur)?.flag }}</span>
              <span>{{ cur }}</span>
              <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                {{ getCurrencyByCode(cur)?.name }}
              </span>
            </button>
          </PopoverContent>
        </Popover>

        <span
          v-else
          class="text-lg leading-none text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {{ currencySymbol }}
        </span>
      </div>
    </div>

    <!--
      Живой регион только для предупреждения: прогноз остатка меняется на каждое
      нажатие, и с `aria-live="polite"` скринридер зачитывал бы строку на
      каждую цифру.
    -->
    <div
      v-if="currentBalance !== undefined && !secondPart"
      class="min-h-5"
      role="status"
      :aria-live="balanceLine?.tone === 'warning' ? 'polite' : 'off'"
    >
      <p
        v-if="balanceLine"
        class="flex flex-wrap items-baseline gap-x-2.5 text-body-sm"
        :class="
          balanceLine.tone === 'warning'
            ? 'font-semibold text-warning'
            : 'text-text-secondary-light dark:text-text-secondary-dark'
        "
      >
        <span>{{ balanceLine.text }}</span>
        <button
          v-if="balanceLine.tone === 'warning' && shortfallPart"
          type="button"
          data-testid="cover-shortfall"
          class="rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-hover"
          @click="emit('update:secondPart', shortfallPart)"
        >
          Доплатить с другого счёта
        </button>
      </p>
    </div>

    <PaymentPartsEditor
      v-if="allowSecondPart && secondPart"
      class="mt-1.5"
      :model-value="secondPart"
      :accounts="accounts"
      :primary-account-id="accountId"
      :currency="currency"
      :total="amount"
      :sign="sign"
      primary-pickable
      @update:model-value="emit('update:secondPart', $event)"
      @update:primary-account-id="emit('update:accountId', $event)"
    />
  </div>
</template>

<style scoped>
.amount-value {
  transition:
    font-size 200ms cubic-bezier(0.4, 0, 0.2, 1),
    color 200ms ease;
}
.amount-currency,
.account-trigger {
  transition:
    color 200ms ease,
    background-color 200ms ease;
}

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
  .amount-currency,
  .account-trigger,
  .amount-caret {
    transition: none;
  }
}
</style>
