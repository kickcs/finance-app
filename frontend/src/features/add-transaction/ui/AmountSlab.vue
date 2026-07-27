<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue';
import { useEventListener, useTimeoutFn } from '@vueuse/core';
import { UIcon } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import {
  formatCurrency,
  formatNumberWithSpaces,
  sanitizeCurrencyInput,
} from '@/shared/lib/format/currency';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { useHaptics } from '@/shared/lib/haptics';
import { TRANSACTION_TYPES, type TransactionType } from '../model/useTransactionForm';

const props = defineProps<{
  amount: number;
  currency: string;
  currencySymbol: string;
  availableCurrencies: string[];
  isMultiCurrency: boolean;
  type: TransactionType;
  /**
   * Куда движутся деньги по счёту. Знака перед суммой нет — направление
   * читается строкой под ней («Останется» против «Станет») и полоской доли.
   * `null` — счёт выбирается внутри панели (долг), показывать нечего.
   */
  sign: 'minus' | 'plus' | null;
  currentBalance?: number;
  showInsufficientFunds?: boolean;
  autofocus?: boolean;
  /** Частые суммы пользователя. Пустой список — ряд не рисуется вовсе. */
  suggestions?: number[];
}>();

const emit = defineEmits<{
  'update:amount': [value: number];
  'update:currency': [value: string];
  'update:type': [value: TransactionType];
  back: [];
}>();

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Расход',
  income: 'Доход',
  transfer: 'Перевод',
  debt: 'Долг',
};

const inputId = useId();
const hiddenInputRef = ref<HTMLInputElement | null>(null);
const currencyOpen = ref(false);
const isFocused = ref(false);
const amountBounce = ref(false);
const rawValue = ref(props.amount ? String(props.amount) : '');

const { trigger } = useHaptics();

useEventListener(hiddenInputRef, 'focus', () => (isFocused.value = true));
useEventListener(hiddenInputRef, 'blur', () => (isFocused.value = false));

/**
 * Числового сравнения достаточно, чтобы не переписывать набираемое: пока печатают,
 * `props.amount` — эхо нашего же emit. Отдельного бэйла по фокусу быть не должно,
 * иначе внешняя установка суммы (чип частой суммы) не доезжает до поля: в Safari
 * тап по кнопке не снимает фокус с input, и на экране остаётся старое число.
 */
watch(
  () => props.amount,
  (newAmount) => {
    if ((parseFloat(rawValue.value) || 0) !== newAmount) {
      rawValue.value = newAmount ? String(newAmount) : '';
    }
  },
);

const activeIndex = computed(() => TRANSACTION_TYPES.indexOf(props.type));

const displayAmount = computed(() => {
  if (!rawValue.value) return '0';
  const dotIndex = rawValue.value.indexOf('.');
  if (dotIndex === -1) return formatNumberWithSpaces(rawValue.value) || '0';
  const intPart = rawValue.value.slice(0, dotIndex);
  const decPart = rawValue.value.slice(dotIndex); // вместе с точкой
  return (formatNumberWithSpaces(intPart || '0') || '0') + decPart;
});

// Кегль ступенями по числу значащих цифр: в UZS суммы длинные (3 068 000 — семь
// цифр), и на фиксированном кегле они упираются в края плиты.
const amountSizeClass = computed(() => {
  const digits = displayAmount.value.replace(/\D/g, '').length;
  if (digits <= 6) return 'text-[2.75rem]';
  if (digits <= 8) return 'text-4xl';
  return 'text-3xl';
});

/** Остаток по счёту после операции — то, ради чего сумму и вводят. */
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

/**
 * Доля баланса, которую съедает вводимая сумма. Единственный элемент плиты,
 * который показывает то, чего нет в цифрах: масштаб траты относительно счёта.
 * Только для списания — на доходе делить нечего.
 */
const spendShare = computed(() => {
  if (props.sign !== 'minus' || !props.currentBalance || props.currentBalance <= 0) return null;
  if (props.amount <= 0) return 0;
  return Math.min(props.amount / props.currentBalance, 1);
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

function selectAmount(value: number) {
  trigger('selection');
  emit('update:amount', value);
}

function selectType(next: TransactionType) {
  if (next === props.type) return;
  trigger('selection');
  emit('update:type', next);
}

onMounted(() => {
  if (props.autofocus) {
    nextTick(() => hiddenInputRef.value?.focus());
  }
});
</script>

<template>
  <div class="slab relative rounded-b-[2rem] pb-5 text-white">
    <!--
      Шапка повторяет геометрию `AppHeader` — те же отступы, размер кнопки и
      кегль заголовка. Отличается только подложкой: здесь под ней плита, а не
      фон страницы.
    -->
    <div class="flex items-center gap-3 px-5 py-3">
      <button
        type="button"
        aria-label="Назад"
        class="slab-control -ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/15"
        @click="emit('back')"
      >
        <UIcon name="arrow_back" size="sm" />
      </button>

      <h1 class="text-lg font-semibold">Новая транзакция</h1>
    </div>

    <div class="px-4 pb-4">
      <div class="relative flex min-w-0 rounded-full bg-white/12 p-1">
        <span
          class="slab-indicator absolute inset-y-1 left-1 rounded-full bg-white"
          :style="{
            width: `calc((100% - 0.5rem) / ${TRANSACTION_TYPES.length})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }"
          aria-hidden="true"
        />
        <button
          v-for="t in TRANSACTION_TYPES"
          :key="t"
          type="button"
          :data-testid="`type-${t}`"
          :aria-pressed="t === type"
          class="slab-control relative z-10 min-w-0 flex-1 rounded-full py-1.5 text-body-sm font-medium"
          :class="t === type ? 'text-primary' : 'text-white/75 hover:text-white'"
          @click="selectType(t)"
        >
          {{ TYPE_LABELS[t] }}
        </button>
      </div>
    </div>

    <!--
      Скрытый input лежит под всей строкой, а сама строка не ловит указатель —
      тапом попадаешь в поле откуда угодно, а кнопка валюты (единственная с
      pointer-events) остаётся кликабельной.
    -->
    <div class="relative cursor-text px-4 py-1">
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

      <div
        class="pointer-events-none relative flex min-h-[3.25rem] items-baseline justify-center gap-1.5"
      >
        <span
          class="slab-amount font-bold leading-none tabular-nums tracking-tight"
          :class="[
            amountSizeClass,
            amount ? 'text-white' : 'text-white/45',
            amountBounce && 'scale-[1.03]',
          ]"
        >
          {{ displayAmount }}
        </span>

        <span
          class="slab-caret inline-block w-[2px] self-center rounded-full bg-white"
          :class="isFocused ? 'h-9 animate-caret-blink' : 'h-9 opacity-0'"
        />

        <!-- Валюта — часть той же типографической строки, а не пилюля у края -->
        <Popover v-if="isMultiCurrency" v-model:open="currencyOpen">
          <PopoverTrigger as-child>
            <button
              type="button"
              aria-label="Выбрать валюту"
              class="slab-control pointer-events-auto -my-1 inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-lg leading-none text-white/60 hover:bg-white/15 hover:text-white"
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

        <span v-else class="text-lg leading-none text-white/60">{{ currencySymbol }}</span>
      </div>
    </div>

    <!--
      Доля баланса, уходящая на эту трату. Место под полоску держим и на нуле:
      иначе первая набранная цифра дёргала бы вниз всё содержимое карточки.
    -->
    <div
      v-if="spendShare !== null"
      class="slab-share-track mx-auto mt-2 h-1 w-40 overflow-hidden rounded-full bg-white/20"
      :class="amount > 0 ? 'opacity-100' : 'opacity-0'"
      aria-hidden="true"
    >
      <div
        class="slab-share h-full rounded-full"
        :class="showInsufficientFunds ? 'bg-warning' : 'bg-white/85'"
        :style="{ width: `${Math.round(spendShare * 100)}%` }"
      />
    </div>

    <!--
      Живой регион только для предупреждения: прогноз остатка меняется на каждое
      нажатие, и с `aria-live="polite"` скринридер зачитывал бы строку на каждую
      цифру.
    -->
    <div
      v-if="currentBalance !== undefined"
      class="mt-2 h-5 text-center"
      role="status"
      :aria-live="balanceLine?.tone === 'warning' ? 'polite' : 'off'"
    >
      <p
        v-if="balanceLine"
        class="text-body-sm"
        :class="balanceLine.tone === 'warning' ? 'font-semibold text-warning' : 'text-white/70'"
      >
        {{ balanceLine.text }}
      </p>
    </div>

    <!--
      Частые суммы живут на плите, а не в карточке: это тот же ввод суммы, и
      рядом с ней они читаются как продолжение поля, а не как отдельный блок.
    -->
    <div
      v-if="suggestions?.length"
      class="no-scrollbar mt-2.5 flex justify-center gap-1.5 overflow-x-auto px-4"
    >
      <button
        v-for="value in suggestions"
        :key="value"
        type="button"
        class="slab-control shrink-0 rounded-full px-3 py-1.5 text-body-sm font-medium tabular-nums"
        :class="
          value === amount ? 'bg-white text-primary' : 'bg-white/15 text-white hover:bg-white/25'
        "
        @mousedown.prevent
        @click="selectAmount(value)"
      >
        {{ formatNumberWithSpaces(String(value)) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/*
 * Плита всегда фирменного цвета, а не семантического цвета типа операции:
 * `primary` настраивается пользователем в профиле, и экран наследует его выбор.
 * Красный фон на расходе (80% заходов) читался бы как ошибка.
 */
.slab {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-pressed));
  /* Отступ шапки задают её собственные `py-3` — плита добавляет только вырез. */
  padding-top: var(--safe-area-inset-top);
}

.slab-indicator,
.slab-amount,
.slab-share,
.slab-share-track,
.slab-control {
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}
.slab-share-track {
  transition-property: opacity;
}
.slab-indicator {
  transition-property: transform;
}
.slab-amount {
  transition-property: transform, font-size;
  transition-duration: 200ms;
}
.slab-share {
  transition-property: width, background-color;
}
.slab-control {
  transition-property: color, background-color;
  transition-duration: 200ms;
}
.slab-caret {
  transition: opacity 150ms ease;
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
  .slab-indicator,
  .slab-amount,
  .slab-share,
  .slab-share-track,
  .slab-control,
  .slab-caret {
    transition: none;
  }
}
</style>
