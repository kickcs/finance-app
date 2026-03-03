<script setup lang="ts">
import { ref, computed, useTemplateRef } from 'vue';
import { UIcon, SwipeableItem } from '@/shared/ui';
import { formatCurrency, getCurrencySymbol } from '@/shared/lib/format/currency';
import { cn } from '@/shared/lib/utils';
import { useHaptics } from '@/shared/lib/haptics';
import { calcLineTotal, calcLineTotalWithService } from '../model/calcLineTotal';
import type { ReceiptItem } from '../model/types';

const props = defineProps<{
  item: ReceiptItem;
  index: number;
  currency: string;
  serviceChargePercent: number | null;
  isInvalid?: boolean;
}>();

const emit = defineEmits<{
  update: [updates: Partial<ReceiptItem>];
  delete: [];
  focusNext: [currentField: 'name' | 'price' | 'qty'];
}>();

const { trigger } = useHaptics();

const isEditing = ref(false);

const nameInputRef = useTemplateRef<HTMLInputElement>('nameInput');
const qtyInputRef = useTemplateRef<HTMLInputElement>('qtyInput');
const priceInputRef = useTemplateRef<HTMLInputElement>('priceInput');

function focusField(field: 'name' | 'price' | 'qty') {
  const el = { name: nameInputRef, qty: qtyInputRef, price: priceInputRef }[field]?.value;
  if (!el) return;
  el.focus();
  if (field !== 'name') el.select();
}

defineExpose({ focusField });

const currencySymbol = computed(() => getCurrencySymbol(props.currency));
const lineTotal = computed(() => calcLineTotal(props.item));
const lineTotalWithService = computed(() =>
  calcLineTotalWithService(props.item, props.serviceChargePercent),
);
const serviceAmount = computed(() => lineTotalWithService.value - lineTotal.value);
const hasServiceCharge = computed(
  () => !!props.serviceChargePercent && props.serviceChargePercent > 0 && serviceAmount.value > 0,
);

function decrementQty() {
  trigger('selection');
  const newQty = Math.max(0.01, Math.round((props.item.qty - 1) * 100) / 100);
  emit('update', { qty: newQty });
}

function incrementQty() {
  trigger('selection');
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
      :class="
        cn(
          'relative pl-4 pr-3 py-2.5 rounded-xl overflow-hidden',
          'bg-card-light dark:bg-card-dark',
          'border border-border-light dark:border-border-dark',
          isEditing && 'border-primary/40 ring-1 ring-primary/20',
          props.isInvalid && 'border-danger ring-1 ring-danger/30',
        )
      "
    >
      <!-- Accent left bar -->
      <div
        :class="
          cn(
            'absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-colors duration-200',
            isEditing ? 'bg-primary' : 'bg-primary/30',
          )
        "
      />

      <!-- Row 1: index + name + line total -->
      <div class="flex items-center gap-2 mb-1.5">
        <span class="text-caption tabular-nums text-primary/60 font-semibold shrink-0">
          {{ index + 1 }}
        </span>
        <input
          ref="nameInput"
          :value="item.name"
          type="text"
          inputmode="text"
          placeholder="Название"
          :aria-label="`Название позиции ${index + 1}`"
          class="flex-1 min-w-0 bg-transparent border-none outline-none text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark focus:placeholder:opacity-0 transition-all focus:bg-surface-light dark:focus:bg-surface-dark focus:px-2 focus:-mx-2 rounded"
          @input="emit('update', { name: ($event.target as HTMLInputElement).value })"
          @focus="isEditing = true"
          @blur="isEditing = false"
          @keydown.enter.prevent="emit('focusNext', 'name')"
        />
        <span class="text-body-sm font-bold tabular-nums shrink-0 text-primary">
          {{ formatCurrency(hasServiceCharge ? lineTotalWithService : lineTotal, currency) }}
        </span>
      </div>

      <!-- Row 2: qty stepper × unit price -->
      <div class="flex items-center gap-1.5 pl-4">
        <!-- Quantity stepper -->
        <div
          class="flex items-center bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark"
        >
          <button
            type="button"
            :aria-label="`Уменьшить количество позиции ${index + 1}`"
            class="w-6 h-6 rounded-l-lg flex items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary hover:bg-primary/5 active:scale-90 transition-all"
            @click="decrementQty"
          >
            <UIcon name="remove" size="xs" />
          </button>
          <input
            ref="qtyInput"
            :value="item.qty"
            type="number"
            inputmode="decimal"
            min="0.01"
            step="0.01"
            :aria-label="`Количество позиции ${index + 1}`"
            class="w-8 h-6 text-center bg-transparent border-none outline-none text-caption font-semibold rounded text-text-primary-light dark:text-text-primary-dark tabular-nums focus:bg-background-light dark:focus:bg-background-dark"
            @input="
              emit('update', { qty: parseFloat(($event.target as HTMLInputElement).value) || 1 })
            "
            @focus="isEditing = true"
            @blur="isEditing = false"
            @keydown.enter.prevent="emit('focusNext', 'qty')"
          />
          <button
            type="button"
            :aria-label="`Увеличить количество позиции ${index + 1}`"
            class="w-6 h-6 rounded-r-lg flex items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary hover:bg-primary/5 active:scale-90 transition-all"
            @click="incrementQty"
          >
            <UIcon name="add" size="xs" />
          </button>
        </div>

        <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">×</span>

        <!-- Unit price -->
        <input
          ref="priceInput"
          :value="item.unitPrice"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="0"
          :aria-label="`Цена за единицу позиции ${index + 1}`"
          class="w-20 bg-transparent outline-none text-caption font-medium text-right text-text-secondary-light dark:text-text-secondary-dark tabular-nums transition-all border-b border-transparent focus:border-primary focus:bg-surface-light dark:focus:bg-surface-dark focus:px-1 focus:-mx-1 rounded-t"
          @input="
            emit('update', {
              unitPrice: parseFloat(($event.target as HTMLInputElement).value) || 0,
            })
          "
          @focus="isEditing = true"
          @blur="isEditing = false"
          @keydown.enter.prevent="emit('focusNext', 'price')"
        />
        <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark shrink-0">
          {{ currencySymbol }}
        </span>
      </div>
    </div>
  </SwipeableItem>
</template>
