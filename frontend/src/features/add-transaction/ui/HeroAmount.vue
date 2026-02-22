<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import { formatNumberWithSpaces, formatCurrency } from '@/shared/lib/format/currency';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';

const props = defineProps<{
  amount: number;
  currency: string;
  currencySymbol: string;
  availableCurrencies: string[];
  isMultiCurrency: boolean;
  label?: string;
  showInsufficientFunds?: boolean;
  currentBalance?: number;
  autofocus?: boolean;
}>();

const emit = defineEmits<{
  'update:amount': [value: number];
  'update:currency': [value: string];
}>();

const hiddenInputRef = ref<HTMLInputElement | null>(null);
const currencyOpen = ref(false);
const amountBounce = ref(false);

const displayAmount = computed(() => {
  if (!props.amount) return '0';
  return formatNumberWithSpaces(props.amount);
});

function focusInput() {
  hiddenInputRef.value?.focus();
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  const num = Number(value) || 0;
  // Bounce animation on first digit
  if (!props.amount && num > 0) {
    amountBounce.value = true;
    setTimeout(() => (amountBounce.value = false), 200);
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
      :for="`amount-input-${currency}`"
      class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ label }}
    </label>

    <!-- Amount row: amount dead-center, currency absolutely positioned right -->
    <div class="relative w-full">
      <!-- Amount display + hidden input (true center) -->
      <div class="relative cursor-text text-center py-1 group" @click="focusInput">
        <input
          :id="`amount-input-${currency}`"
          ref="hiddenInputRef"
          type="number"
          inputmode="numeric"
          :value="amount || ''"
          :aria-label="label || 'Сумма'"
          class="absolute inset-0 w-full h-full opacity-0 caret-transparent cursor-text"
          @input="onInput"
          @keydown.enter.prevent
        />
        <span
          class="text-4xl font-semibold tabular-nums transition-[color,transform,opacity] duration-200 group-hover:opacity-80"
          :class="[
            amount
              ? 'text-text-primary-light dark:text-text-primary-dark'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark',
            amountBounce && 'scale-105',
          ]"
        >
          {{ displayAmount }}
        </span>
      </div>

      <!-- Currency selector (absolute right) -->
      <Popover v-if="isMultiCurrency" v-model:open="currencyOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-primary-light transition-colors"
          >
            {{ getCurrencyByCode(currency)?.flag }}
            {{ currency }}
            <UIcon
              name="expand_more"
              size="xs"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" :side-offset="8" class="w-auto min-w-[140px] p-1">
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

      <!-- Static currency symbol (absolute right) -->
      <span
        v-else
        class="absolute right-2 top-1/2 -translate-y-1/2 text-lg font-medium text-text-secondary-light dark:text-text-secondary-dark"
      >
        {{ currencySymbol }}
      </span>
    </div>

    <!-- Balance / insufficient funds -->
    <div class="h-5 text-center">
      <p v-if="showInsufficientFunds && amount > 0" class="text-xs text-warning">
        Недостаточно средств.
        {{ formatCurrency(currentBalance ?? 0, currency) }}
      </p>
      <p
        v-else-if="currentBalance !== undefined"
        class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        Баланс: {{ formatCurrency(currentBalance, currency) }}
      </p>
    </div>
  </div>
</template>
