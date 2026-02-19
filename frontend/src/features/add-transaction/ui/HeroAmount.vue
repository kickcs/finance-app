<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import {
  formatNumberWithSpaces,
  formatCurrency,
} from '@/shared/lib/format/currency';

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

const displayAmount = computed(() => {
  if (!props.amount) return '0';
  return formatNumberWithSpaces(props.amount);
});

function focusInput() {
  hiddenInputRef.value?.focus();
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  emit('update:amount', Number(value) || 0);
}

function onCurrencyChange(event: Event) {
  emit('update:currency', (event.target as HTMLSelectElement).value);
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
  <div class="flex flex-col items-center gap-1" @click="focusInput">
    <label
      v-if="label"
      class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ label }}
    </label>

    <!-- Hidden native input for keyboard -->
    <input
      ref="hiddenInputRef"
      type="number"
      inputmode="numeric"
      :value="amount || ''"
      class="sr-only"
      @input="onInput"
      @keydown.enter.prevent
    />

    <!-- Amount display with currency badge -->
    <div class="flex items-center gap-2">
      <span
        class="text-4xl font-semibold text-text-primary-light dark:text-text-primary-dark tabular-nums"
      >
        {{ displayAmount }}
      </span>

      <!-- Multi-currency select -->
      <div v-if="isMultiCurrency" class="relative">
        <select
          :value="currency"
          class="appearance-none bg-surface-light dark:bg-surface-dark rounded-lg px-2 pr-6 py-1 text-sm font-medium border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
          @click.stop
          @change="onCurrencyChange"
        >
          <option v-for="cur in availableCurrencies" :key="cur" :value="cur">
            {{ getCurrencyByCode(cur)?.flag }} {{ cur }}
          </option>
        </select>
        <UIcon
          name="expand_more"
          size="sm"
          class="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary-light dark:text-text-tertiary-dark"
        />
      </div>

      <!-- Static currency symbol -->
      <span
        v-else
        class="text-lg font-medium text-text-secondary-light dark:text-text-secondary-dark"
      >
        {{ currencySymbol }}
      </span>
    </div>

    <!-- Balance / insufficient funds -->
    <div class="h-5 text-center">
      <p
        v-if="showInsufficientFunds && amount > 0"
        class="text-xs text-warning"
      >
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
