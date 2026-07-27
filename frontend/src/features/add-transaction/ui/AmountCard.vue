<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { UIcon } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import type { AccountWithBalances } from '@/entities/account';
import { formatCurrency } from '@/shared/lib/format/currency';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { useHaptics } from '@/shared/lib/haptics';
import { useAmountInput } from '../model/useAmountInput';

/**
 * Сумма операции на карточке выбранного счёта.
 *
 * Цвет карточки — цвет счёта, а не общий акцент приложения: он единственный
 * здесь несёт информацию (с какого счёта уйдут деньги), поэтому и тратится
 * на него. Переключил счёт — экран сменил тон.
 */
const props = defineProps<{
  amount: number;
  currency: string;
  currencySymbol: string;
  availableCurrencies: string[];
  isMultiCurrency: boolean;
  /** Счета для выбора прямо на карточке — отдельный ряд чипов её дублировал. */
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
  autofocus?: boolean;
}>();

const emit = defineEmits<{
  'update:amount': [value: number];
  'update:currency': [value: string];
  'update:accountId': [value: string];
}>();

const FALLBACK_ACCENT = 'var(--color-primary)';

const inputId = useId();
const currencyOpen = ref(false);
const accountOpen = ref(false);

const { trigger } = useHaptics();

function selectAccount(id: string) {
  trigger('selection');
  emit('update:accountId', id);
  accountOpen.value = false;
}

const {
  inputRef: hiddenInputRef,
  rawValue,
  displayAmount,
  isFocused,
  isBouncing,
  onInput,
} = useAmountInput({
  amount: () => props.amount,
  autofocus: () => props.autofocus,
  onChange: (value) => emit('update:amount', value),
});

const accent = computed(() => props.accountColor || FALLBACK_ACCENT);

const tintStyle = computed(() => ({ backgroundColor: accent.value }));
const borderStyle = computed(() => ({
  borderColor: `color-mix(in srgb, ${accent.value} 30%, transparent)`,
}));

// Кегль ступенями по числу значащих цифр: в UZS суммы длинные (3 068 000 —
// семь цифр), и на фиксированном кегле они упираются в край карточки.
const amountSizeClass = computed(() => {
  const digits = displayAmount.value.replace(/\D/g, '').length;
  if (digits <= 6) return 'text-[3.25rem]';
  if (digits <= 8) return 'text-[2.5rem]';
  return 'text-3xl';
});

const projectedBalance = computed(() => {
  if (props.currentBalance === undefined || !props.sign) return null;
  return props.sign === 'minus'
    ? props.currentBalance - props.amount
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
      text: `Не хватает ${withSymbol(props.amount - props.currentBalance)}`,
    };
  }

  if (props.amount > 0 && projectedBalance.value !== null) {
    const verb = props.sign === 'minus' ? 'Останется' : 'Станет';
    return { tone: 'muted' as const, text: `${verb} ${withSymbol(projectedBalance.value)}` };
  }

  return { tone: 'muted' as const, text: `Баланс ${withSymbol(props.currentBalance)}` };
});

function selectCurrency(cur: string) {
  emit('update:currency', cur);
  currencyOpen.value = false;
}
</script>

<template>
  <div
    class="amount-card relative overflow-hidden rounded-2xl border bg-card-light dark:bg-card-dark"
    :style="borderStyle"
  >
    <!-- Тон счёта: отдельным слоем, чтобы один и тот же цвет читался и на
         светлой карточке, и на тёмной. -->
    <div class="pointer-events-none absolute inset-0 opacity-[0.07]" :style="tintStyle" />
    <div class="absolute inset-y-0 left-0 w-1" :style="tintStyle" />

    <div class="relative px-4 py-4 pl-5">
      <Popover v-if="accountName" v-model:open="accountOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            data-testid="account-trigger"
            aria-label="Выбрать счёт"
            class="account-trigger -ml-1 flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 text-caption font-semibold uppercase tracking-wider"
            :style="{ color: accent }"
          >
            <span class="truncate">{{ accountName }}</span>
            <UIcon v-if="accounts.length > 1" name="expand_more" size="xs" class="shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          :side-offset="6"
          class="w-max min-w-[12rem] max-w-[min(20rem,calc(100vw-2rem))] p-1"
        >
          <button
            v-for="account in accounts"
            :key="account.id"
            type="button"
            :class="[
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors',
              account.id === accountId
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-text-primary-light hover:bg-surface-light dark:text-text-primary-dark dark:hover:bg-surface-dark',
            ]"
            @click="selectAccount(account.id)"
          >
            <span
              class="h-3 w-3 shrink-0 rounded-full"
              :style="{ backgroundColor: account.color }"
            />
            <span class="min-w-0 flex-1 truncate text-left">{{ account.name }}</span>
            <span
              class="shrink-0 whitespace-nowrap text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{
                formatCurrency(
                  account.balances[0]?.balance ?? 0,
                  account.balances[0]?.currency ?? '',
                )
              }}
            </span>
          </button>
        </PopoverContent>
      </Popover>

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
              isBouncing && 'scale-[1.03]',
            ]"
          >
            {{ displayAmount }}
          </span>

          <span
            class="amount-caret inline-block w-[2px] self-center rounded-full transition-opacity duration-150"
            :class="isFocused ? 'h-10 animate-caret-blink' : 'h-10 opacity-0'"
            :style="isFocused ? tintStyle : undefined"
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
        Живой регион только для предупреждения: прогноз остатка меняется на
        каждое нажатие, и с `aria-live="polite"` скринридер зачитывал бы строку
        на каждую цифру.
      -->
      <div
        v-if="currentBalance !== undefined"
        class="h-5"
        role="status"
        :aria-live="balanceLine?.tone === 'warning' ? 'polite' : 'off'"
      >
        <p
          v-if="balanceLine"
          class="text-body-sm"
          :class="
            balanceLine.tone === 'warning'
              ? 'font-semibold text-warning'
              : 'text-text-secondary-light dark:text-text-secondary-dark'
          "
        >
          {{ balanceLine.text }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.amount-value {
  transition:
    transform 200ms cubic-bezier(0.4, 0, 0.2, 1),
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
