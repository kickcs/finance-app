<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed, useId } from 'vue';
import { useEventListener, useTimeoutFn } from '@vueuse/core';
import { UIcon } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import {
  formatNumberWithSpaces,
  formatCurrency,
  sanitizeCurrencyInput,
} from '@/shared/lib/format/currency';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';

const props = withDefaults(
  defineProps<{
    amount: number;
    currency: string;
    currencySymbol: string;
    availableCurrencies: string[];
    isMultiCurrency: boolean;
    label?: string;
    showInsufficientFunds?: boolean;
    currentBalance?: number;
    autofocus?: boolean;
    /**
     * `hero` — единственная сумма на экране: крупный кегль со ступенями по числу
     * цифр. `compact` — сумма в ряду с другими полями (обе суммы перевода,
     * подтверждение импорта), кегль фиксированный.
     */
    variant?: 'hero' | 'compact';
    /**
     * Знак перед суммой. Он же переключает строку под суммой с «Баланс» на
     * прогноз остатка — единственное место, где на экране тратится
     * семантический цвет.
     */
    sign?: 'minus' | 'plus' | null;
  }>(),
  { variant: 'compact', sign: null },
);

const emit = defineEmits<{
  'update:amount': [value: number];
  'update:currency': [value: string];
}>();

const inputId = useId();
const hiddenInputRef = ref<HTMLInputElement | null>(null);
const currencyOpen = ref(false);
const amountBounce = ref(false);
const isFocused = ref(false);
const rawValue = ref(props.amount ? String(props.amount) : '');

watch(
  () => props.amount,
  (newAmount) => {
    // Числового сравнения достаточно, чтобы не переписывать набираемое: пока
    // печатают, `props.amount` — эхо нашего же emit, и значения совпадают.
    // Отдельного бэйла по фокусу быть не должно — иначе внешняя установка суммы
    // (чип подсказки) не доезжает до поля: в Safari тап по кнопке не снимает
    // фокус с input, и на экране остаётся старое число.
    const currentParsed = parseFloat(rawValue.value) || 0;
    if (currentParsed !== newAmount) {
      rawValue.value = newAmount ? String(newAmount) : '';
    }
  },
);

useEventListener(hiddenInputRef, 'focus', () => (isFocused.value = true));
useEventListener(hiddenInputRef, 'blur', () => (isFocused.value = false));

const displayAmount = computed(() => {
  if (!rawValue.value) return '0';
  const dotIndex = rawValue.value.indexOf('.');
  if (dotIndex === -1) return formatNumberWithSpaces(rawValue.value) || '0';
  const intPart = rawValue.value.slice(0, dotIndex);
  const decPart = rawValue.value.slice(dotIndex); // includes the dot
  return (formatNumberWithSpaces(intPart || '0') || '0') + decPart;
});

// Кегль ступенями по числу значащих цифр: в UZS суммы длинные (3 068 000 — семь
// цифр), и на фиксированных 44px они упираются в края экрана.
const amountSizeClass = computed(() => {
  if (props.variant === 'compact') return 'text-4xl';
  const digits = displayAmount.value.replace(/\D/g, '').length;
  if (digits <= 6) return 'text-[2.75rem]';
  if (digits <= 8) return 'text-4xl';
  return 'text-3xl';
});

const signGlyph = computed(() => (props.sign === 'minus' ? '−' : props.sign === 'plus' ? '+' : ''));
const signColorClass = computed(() => (props.sign === 'minus' ? 'text-danger' : 'text-success'));

/** Остаток по счёту после операции — то, ради чего сумму и вводят. */
const projectedBalance = computed(() => {
  if (props.currentBalance === undefined || !props.sign) return null;
  return props.sign === 'minus'
    ? props.currentBalance - props.amount
    : props.currentBalance + props.amount;
});

/**
 * Печатаем сумму с тем же символом валюты, что и в самой строке ввода:
 * `Intl` для UZS отдаёт код «UZS», и под «250 000 сўм» появлялось
 * «Останется 6 848 000 UZS» — две записи одной валюты в двух строках подряд.
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

const { start: startBounce } = useTimeoutFn(() => (amountBounce.value = false), 160, {
  immediate: false,
});

function onInput(event: Event) {
  const sanitized = sanitizeCurrencyInput((event.target as HTMLInputElement).value);
  rawValue.value = sanitized;
  const num = parseFloat(sanitized) || 0;
  if (!props.amount && num > 0) {
    amountBounce.value = true;
    startBounce();
  }
  emit('update:amount', num);
}

function selectCurrency(cur: string) {
  emit('update:currency', cur);
  currencyOpen.value = false;
}

onMounted(() => {
  if (props.autofocus) {
    nextTick(() => {
      hiddenInputRef.value?.focus();
    });
  }
});
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <label
      v-if="label"
      :for="inputId"
      class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ label }}
    </label>

    <!--
      Скрытый input лежит под всей строкой, а сама строка не ловит указатель —
      поэтому тапом попадаешь в поле откуда угодно, а кнопка валюты (единственная
      с pointer-events) остаётся кликабельной.
    -->
    <div class="relative w-full cursor-text" :class="variant === 'hero' ? 'py-2' : 'py-1'">
      <input
        :id="inputId"
        ref="hiddenInputRef"
        type="text"
        inputmode="decimal"
        :value="rawValue"
        :aria-label="label || 'Сумма'"
        class="absolute inset-0 w-full h-full opacity-0 caret-transparent cursor-text"
        @input="onInput"
        @keydown.enter.prevent
      />

      <div
        class="relative flex items-baseline justify-center gap-1.5 pointer-events-none"
        :class="variant === 'hero' && 'min-h-[3.25rem]'"
      >
        <span
          v-if="signGlyph"
          class="font-semibold leading-none tabular-nums"
          :class="[signColorClass, variant === 'hero' ? 'text-2xl' : 'text-xl']"
          aria-hidden="true"
        >
          {{ signGlyph }}
        </span>

        <span
          class="amount-value font-semibold tabular-nums leading-none transition-[color,transform,font-size] duration-200"
          :class="[
            amountSizeClass,
            amount
              ? 'text-text-primary-light dark:text-text-primary-dark'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark',
            amountBounce && 'scale-[1.03]',
          ]"
        >
          {{ displayAmount }}
        </span>

        <!-- Blinking caret -->
        <span
          class="amount-caret inline-block w-[2px] self-center rounded-full transition-opacity duration-150"
          :class="[
            variant === 'hero' ? 'h-9' : 'h-8',
            isFocused ? 'bg-primary animate-caret-blink' : 'opacity-0',
          ]"
        />

        <!-- Валюта — часть той же типографической строки, а не отдельная пилюля у края -->
        <Popover v-if="isMultiCurrency" v-model:open="currencyOpen">
          <PopoverTrigger as-child>
            <button
              type="button"
              aria-label="Выбрать валюту"
              class="pointer-events-auto inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 -my-1 leading-none text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
              :class="variant === 'hero' ? 'text-lg' : 'text-base'"
            >
              {{ currencySymbol }}
              <UIcon name="expand_more" size="xs" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" :side-offset="8" class="w-auto min-w-[140px] p-1">
            <button
              v-for="cur in availableCurrencies"
              :key="cur"
              type="button"
              :class="[
                'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors',
                cur === currency
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark',
              ]"
              @click="selectCurrency(cur)"
            >
              <span>{{ getCurrencyByCode(cur)?.flag }}</span>
              <span>{{ cur }}</span>
              <span class="text-text-tertiary-light dark:text-text-tertiary-dark text-xs">
                {{ getCurrencyByCode(cur)?.name }}
              </span>
            </button>
          </PopoverContent>
        </Popover>

        <span
          v-else
          class="leading-none text-text-tertiary-light dark:text-text-tertiary-dark"
          :class="variant === 'hero' ? 'text-lg' : 'text-base'"
        >
          {{ currencySymbol }}
        </span>
      </div>

      <!-- Focus underline -->
      <div
        class="amount-underline absolute bottom-0 left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-primary transition-all duration-300 ease-out"
        :class="isFocused ? 'w-16 opacity-100' : 'w-0 opacity-0'"
      />
    </div>

    <!-- Баланс / нехватка средств -->
    <!--
      Живой регион только для предупреждения: прогноз остатка меняется на каждое
      нажатие, и с `aria-live="polite"` скринридер зачитывал бы всю строку на
      каждую цифру.
    -->
    <div
      class="h-5 text-center"
      role="status"
      :aria-live="balanceLine?.tone === 'warning' ? 'polite' : 'off'"
    >
      <p
        v-if="balanceLine"
        class="text-xs"
        :class="
          balanceLine.tone === 'warning'
            ? 'text-warning font-medium'
            : 'text-text-tertiary-light dark:text-text-tertiary-dark'
        "
      >
        {{ balanceLine.text }}
      </p>
    </div>
  </div>
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
