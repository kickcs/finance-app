<script setup lang="ts">
import { ref, computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { SwipeableItem } from '@/shared/ui';
import { formatCurrency, getCurrencySymbol } from '@/shared/lib/format/currency';
import { cn } from '@/shared/lib/utils';
import type { ReceiptItem } from '../model/types';

const props = defineProps<{
  item: ReceiptItem;
  index: number;
  currency: string;
}>();

const emit = defineEmits<{
  update: [updates: Partial<ReceiptItem>];
  delete: [];
}>();

const isEditing = ref(false);

const currencySymbol = computed(() => getCurrencySymbol(props.currency));
const lineTotal = computed(() => props.item.qty * props.item.unitPrice);

function decrementQty() {
  const newQty = Math.max(0.01, Math.round((props.item.qty - 1) * 100) / 100);
  emit('update', { qty: newQty });
}

function incrementQty() {
  const newQty = Math.round((props.item.qty + 1) * 100) / 100;
  emit('update', { qty: newQty });
}
</script>

<template>
  <SwipeableItem
    :left-action="{ icon: 'delete', color: '#ef4444', label: 'Удалить' }"
    :right-action="undefined"
    @action-left="emit('delete')"
  >
    <div
      :class="cn(
        'flex items-start gap-3 px-4 py-3 rounded-xl',
        'bg-card-light dark:bg-card-dark',
        'border border-border-light dark:border-border-dark',
        'shadow-xs',
        isEditing && 'border-primary/40 shadow-soft ring-1 ring-primary/20',
      )"
    >
      <!-- Index number -->
      <div
        class="w-6 h-6 rounded-full bg-surface-light dark:bg-surface-dark
               flex items-center justify-center flex-shrink-0 mt-0.5"
        aria-hidden="true"
      >
        <span class="text-caption font-semibold text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ index + 1 }}
        </span>
      </div>

      <!-- Item details column -->
      <div class="flex-1 min-w-0 space-y-2">

        <!-- Name field -->
        <input
          :value="item.name"
          type="text"
          inputmode="text"
          placeholder="Название товара"
          :aria-label="`Название позиции ${index + 1}`"
          class="w-full bg-transparent border-none outline-none
                 text-body font-medium
                 text-text-primary-light dark:text-text-primary-dark
                 placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark
                 focus:placeholder:opacity-0 transition-all"
          @input="emit('update', { name: ($event.target as HTMLInputElement).value })"
          @focus="isEditing = true"
          @blur="isEditing = false"
        />

        <!-- Qty × Unit price row -->
        <div class="flex items-center gap-2">

          <!-- Quantity stepper -->
          <div class="flex items-center gap-1 bg-surface-light dark:bg-surface-dark rounded-lg px-2 py-1">
            <button
              type="button"
              :aria-label="`Уменьшить количество позиции ${index + 1}`"
              class="w-5 h-5 rounded flex items-center justify-center
                     text-text-secondary-light dark:text-text-secondary-dark
                     hover:text-primary active:scale-90 transition-all"
              @click="decrementQty"
            >
              <UIcon name="remove" size="xs" />
            </button>

            <input
              :value="item.qty"
              type="number"
              inputmode="decimal"
              min="0.01"
              step="0.01"
              :aria-label="`Количество позиции ${index + 1}`"
              class="w-8 text-center bg-transparent border-none outline-none
                     text-body-sm font-semibold
                     text-text-primary-light dark:text-text-primary-dark
                     tabular-nums"
              @input="emit('update', { qty: parseFloat(($event.target as HTMLInputElement).value) || 1 })"
              @focus="isEditing = true"
              @blur="isEditing = false"
            />

            <button
              type="button"
              :aria-label="`Увеличить количество позиции ${index + 1}`"
              class="w-5 h-5 rounded flex items-center justify-center
                     text-text-secondary-light dark:text-text-secondary-dark
                     hover:text-primary active:scale-90 transition-all"
              @click="incrementQty"
            >
              <UIcon name="add" size="xs" />
            </button>
          </div>

          <!-- Multiplication sign -->
          <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">×</span>

          <!-- Unit price -->
          <div class="flex items-center gap-1 flex-1">
            <input
              :value="item.unitPrice"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              :aria-label="`Цена за единицу позиции ${index + 1}`"
              class="flex-1 min-w-0 bg-transparent border-b
                     border-border-light dark:border-border-dark
                     focus:border-primary outline-none
                     text-body-sm font-medium text-right
                     text-text-primary-light dark:text-text-primary-dark
                     tabular-nums pb-0.5 transition-colors"
              @input="emit('update', { unitPrice: parseFloat(($event.target as HTMLInputElement).value) || 0 })"
              @focus="isEditing = true"
              @blur="isEditing = false"
            />
            <span class="text-caption text-text-secondary-light dark:text-text-secondary-dark flex-shrink-0">
              {{ currencySymbol }}
            </span>
          </div>

        </div>
      </div>

      <!-- Line total + delete -->
      <div class="flex flex-col items-end gap-1 flex-shrink-0">
        <span
          class="text-body font-semibold
                 text-text-primary-light dark:text-text-primary-dark
                 tabular-nums transition-all duration-200"
        >
          {{ formatCurrency(lineTotal, currency) }}
        </span>
        <button
          type="button"
          :aria-label="`Удалить позицию ${index + 1}: ${item.name}`"
          class="w-7 h-7 rounded-full flex items-center justify-center
                 text-text-tertiary-light dark:text-text-tertiary-dark
                 hover:text-danger hover:bg-danger-light
                 active:scale-90 transition-all duration-150"
          @click="emit('delete')"
        >
          <UIcon name="delete" size="xs" />
        </button>
      </div>

    </div>
  </SwipeableItem>
</template>
