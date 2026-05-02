<script setup lang="ts">
import { ref } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { cn } from '@/shared/lib/utils';
import type { ReceiptCharge } from '../model/types';

const props = defineProps<{
  charge: ReceiptCharge;
  amount: number;
  currency: string;
}>();

const emit = defineEmits<{
  toggle: [];
  updatePercent: [percent: number];
  updateAmount: [amount: number];
  remove: [];
}>();

const isEditing = ref(false);

function handleInput(event: Event) {
  const value = parseFloat((event.target as HTMLInputElement).value);
  if (isNaN(value) || value < 0) return;
  if (props.charge.type === 'amount') emit('updateAmount', value);
  else emit('updatePercent', value);
}

function handleBlur() {
  isEditing.value = false;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    isEditing.value = false;
  }
}
</script>

<template>
  <div
    :class="
      cn(
        'flex items-center gap-2 py-1 transition-opacity duration-150',
        !charge.enabled && 'opacity-40',
      )
    "
  >
    <!-- Toggle -->
    <button
      type="button"
      :aria-label="`${charge.enabled ? 'Выключить' : 'Включить'} ${charge.label}`"
      class="w-8 h-[18px] rounded-full transition-colors duration-200 relative flex-shrink-0"
      :class="charge.enabled ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'"
      @click="emit('toggle')"
    >
      <div
        class="absolute w-3.5 h-3.5 bg-white rounded-full top-[2px] shadow-sm transition-transform duration-200 ease-in-out"
        :class="charge.enabled ? 'translate-x-[16px]' : 'translate-x-[2px]'"
      />
    </button>

    <!-- Label + percent / amount editor -->
    <div class="flex items-baseline gap-1 flex-1 min-w-0">
      <span
        class="text-caption font-medium text-text-secondary-light dark:text-text-secondary-dark truncate"
      >
        {{ charge.label }}
      </span>
      <button
        v-if="!isEditing && charge.type === 'percent'"
        type="button"
        class="text-caption font-semibold text-primary tabular-nums hover:underline"
        @click="isEditing = true"
      >
        {{ charge.percent }}%
      </button>
      <input
        v-else-if="charge.type === 'percent'"
        :value="charge.percent"
        type="number"
        inputmode="decimal"
        min="0"
        max="100"
        step="0.1"
        class="w-12 text-caption font-semibold text-primary tabular-nums bg-primary/10 rounded px-1 py-0.5 outline-none border border-primary/30"
        autofocus
        @input="handleInput"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />
    </div>

    <!-- Amount: editable for amount-type, read-only for percent-type -->
    <button
      v-if="!isEditing && charge.type === 'amount'"
      type="button"
      class="text-caption font-medium text-primary tabular-nums hover:underline flex-shrink-0"
      @click="isEditing = true"
    >
      +{{ formatCurrency(charge.amount, currency) }}
    </button>
    <input
      v-else-if="isEditing && charge.type === 'amount'"
      :value="charge.amount"
      type="number"
      inputmode="decimal"
      min="0"
      step="1"
      class="w-24 text-caption font-semibold text-primary tabular-nums bg-primary/10 rounded px-1 py-0.5 outline-none border border-primary/30 text-right flex-shrink-0"
      autofocus
      @input="handleInput"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />
    <span v-else class="text-caption font-medium text-primary tabular-nums flex-shrink-0">
      +{{ formatCurrency(amount, currency) }}
    </span>

    <!-- Remove -->
    <button
      type="button"
      :aria-label="`Удалить ${charge.label}`"
      class="w-5 h-5 rounded-full flex items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
      @click="emit('remove')"
    >
      <UIcon name="close" size="xs" />
    </button>
  </div>
</template>
