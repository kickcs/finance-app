<script setup lang="ts">
import { useAmountInput } from '@/shared/lib/hooks/useAmountInput';

/**
 * Сумма платежа героем: скрытый `input` поверх нарисованной строки, каретка и
 * подчёркивание по фокусу.
 *
 * Раскладка та же, что у `HeroAmount`/`AmountHeadline` в add-transaction, но
 * шторки долгов — это другая фича, а фича из фичи импортировать не может,
 * поэтому общий для `PaymentDrawer` и `CloseAllDebtsDrawer` кусок живёт здесь,
 * в сущности долга: обе шторки его уже импортируют.
 */
defineProps<{
  currencySymbol: string;
  /** `data-testid` скрытого поля — тесты шторок целятся именно в него. */
  inputTestid?: string;
  disabled?: boolean;
}>();

const amount = defineModel<number>({ required: true });

const {
  inputRef: hiddenInputRef,
  rawValue,
  displayAmount,
  isFocused,
  onInput,
} = useAmountInput({
  amount: () => amount.value,
  onChange: (value) => (amount.value = value),
});
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <div class="relative w-full cursor-text py-1">
      <input
        ref="hiddenInputRef"
        type="text"
        inputmode="decimal"
        :value="rawValue"
        :disabled="disabled"
        aria-label="Сумма платежа"
        :data-testid="inputTestid"
        class="absolute inset-0 w-full h-full opacity-0 caret-transparent cursor-text"
        @input="onInput"
        @keydown.enter.prevent
      />

      <div class="relative flex items-baseline justify-center gap-1.5 pointer-events-none">
        <span
          class="amount-value text-4xl font-semibold tabular-nums leading-none transition-colors duration-200"
          :class="
            amount
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

        <span class="text-base leading-none text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ currencySymbol }}
        </span>
      </div>

      <div
        class="amount-underline absolute bottom-0 left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-primary transition-all duration-300 ease-out"
        :class="isFocused ? 'w-16 opacity-100' : 'w-0 opacity-0'"
      />
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
