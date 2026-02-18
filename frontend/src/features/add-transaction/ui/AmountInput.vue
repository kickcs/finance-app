<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { UInput, UIcon } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import { formatCurrency } from '@/shared/lib/format/currency';

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

const amountInputRef = ref<InstanceType<typeof UInput> | null>(null);

onMounted(() => {
  if (props.autofocus) {
    nextTick(() => {
      amountInputRef.value?.focus();
    });
  }
});
</script>

<template>
  <div class="space-y-1.5">
    <label
      v-if="label"
      class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ label }}
    </label>
    <div class="flex gap-2">
      <div v-if="isMultiCurrency" class="relative shrink-0">
        <select
          :value="currency"
          class="appearance-none h-full bg-surface-light dark:bg-surface-dark rounded-lg px-2.5 pr-7 text-sm font-medium border border-border-light dark:border-border-dark focus:outline-none focus:ring-2 focus:ring-primary"
          @change="
            emit('update:currency', ($event.target as HTMLSelectElement).value)
          "
        >
          <option v-for="cur in availableCurrencies" :key="cur" :value="cur">
            {{ getCurrencyByCode(cur)?.flag }} {{ cur }}
          </option>
        </select>
        <UIcon
          name="expand_more"
          size="sm"
          class="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary-light dark:text-text-tertiary-dark"
        />
      </div>
      <div class="flex-1">
        <UInput
          ref="amountInputRef"
          :model-value="String(amount || '')"
          placeholder="0"
          variant="currency"
          type="number"
          :suffix="currencySymbol"
          @update:model-value="emit('update:amount', Number($event) || 0)"
          @keydown.enter.prevent
        />
      </div>
    </div>
    <p v-if="showInsufficientFunds && amount > 0" class="text-xs text-warning">
      Недостаточно средств. Баланс:
      {{ formatCurrency(currentBalance ?? 0, currency) }}
    </p>
  </div>
</template>
