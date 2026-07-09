<script setup lang="ts">
import { ref, computed, watch, nextTick, useTemplateRef } from 'vue';
import { UButton, UIcon, UModal } from '@/shared/ui';
import { getCurrencySymbol } from '@/shared/lib/format/currency';
import { useHaptics } from '@/shared/lib/haptics';
import { calcLineTotal } from '../model/calcLineTotal';
import type { ReceiptItem } from '../model/types';

const props = defineProps<{
  open: boolean;
  item: ReceiptItem | null;
  currency: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [updates: Partial<ReceiptItem>];
  split: [];
  delete: [];
}>();

const { trigger } = useHaptics();

const name = ref('');
const qty = ref(1);
const unitPrice = ref(0);
const lineTotal = ref(0);
// true, когда пользователь правил qty/цену/итог — тогда ocrTotalPrice сбросится
const amountsTouched = ref(false);

const nameInputRef = useTemplateRef<HTMLInputElement>('nameInput');
const priceInputRef = useTemplateRef<HTMLInputElement>('priceInput');

const currencySymbol = computed(() => getCurrencySymbol(props.currency));
const canSplit = computed(() => (props.item?.qty ?? 0) > 1);

watch(
  () => props.open,
  (open) => {
    if (!open || !props.item) return;
    name.value = props.item.name;
    qty.value = props.item.qty;
    unitPrice.value = props.item.unitPrice;
    lineTotal.value = calcLineTotal(props.item);
    amountsTouched.value = false;
    if (!props.item.name.trim()) {
      nextTick(() => nameInputRef.value?.focus());
    }
  },
);

function syncTotalFromParts() {
  amountsTouched.value = true;
  lineTotal.value = Math.round(qty.value * unitPrice.value * 100) / 100;
}

function handleQtyInput(event: Event) {
  qty.value = parseFloat((event.target as HTMLInputElement).value) || 1;
  syncTotalFromParts();
}

function handlePriceInput(event: Event) {
  unitPrice.value = parseFloat((event.target as HTMLInputElement).value) || 0;
  syncTotalFromParts();
}

function handleTotalInput(event: Event) {
  const total = parseFloat((event.target as HTMLInputElement).value) || 0;
  amountsTouched.value = true;
  lineTotal.value = total;
  if (qty.value > 0) {
    unitPrice.value = Math.round((total / qty.value) * 100) / 100;
  }
}

function decrementQty() {
  trigger('selection');
  qty.value = Math.max(0.01, Math.round((qty.value - 1) * 100) / 100);
  syncTotalFromParts();
}

function incrementQty() {
  trigger('selection');
  qty.value = Math.round((qty.value + 1) * 100) / 100;
  syncTotalFromParts();
}

function handleSave() {
  trigger('selection');
  const updates: Partial<ReceiptItem> = { name: name.value.trim() };
  if (amountsTouched.value) {
    updates.qty = qty.value;
    updates.unitPrice = unitPrice.value;
  }
  emit('save', updates);
  emit('update:open', false);
}

function handleSplit() {
  emit('update:open', false);
  emit('split');
}

function handleDelete() {
  emit('update:open', false);
  emit('delete');
}
</script>

<template>
  <UModal :model-value="open" title="Позиция" @update:model-value="emit('update:open', $event)">
    <div v-if="item" class="space-y-4">
      <!-- Название -->
      <div>
        <label
          for="item-editor-name"
          class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block"
        >
          Название
        </label>
        <input
          id="item-editor-name"
          ref="nameInput"
          v-model="name"
          type="text"
          placeholder="Что купили?"
          class="w-full px-3 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-body font-medium text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          @keydown.enter.prevent="priceInputRef?.focus()"
        />
      </div>

      <!-- Количество + цена -->
      <div class="flex gap-3">
        <div class="shrink-0">
          <span
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block"
          >
            Количество
          </span>
          <div
            class="flex items-center bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark"
          >
            <button
              type="button"
              aria-label="Уменьшить количество"
              class="w-11 h-11 rounded-l-xl flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:text-primary active:scale-90 transition-all"
              @click="decrementQty"
            >
              <UIcon name="remove" size="sm" />
            </button>
            <input
              :value="qty"
              type="number"
              inputmode="decimal"
              min="0.01"
              step="0.01"
              aria-label="Количество"
              class="w-14 h-11 text-center bg-transparent border-none outline-none text-body font-semibold text-text-primary-light dark:text-text-primary-dark tabular-nums"
              @input="handleQtyInput"
            />
            <button
              type="button"
              aria-label="Увеличить количество"
              class="w-11 h-11 rounded-r-xl flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:text-primary active:scale-90 transition-all"
              @click="incrementQty"
            >
              <UIcon name="add" size="sm" />
            </button>
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <label
            for="item-editor-price"
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block"
          >
            Цена за единицу
          </label>
          <div class="relative">
            <input
              id="item-editor-price"
              ref="priceInput"
              :value="unitPrice"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              class="w-full h-11 pl-3 pr-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-body font-semibold text-text-primary-light dark:text-text-primary-dark outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 tabular-nums"
              @input="handlePriceInput"
              @keydown.enter.prevent="handleSave"
            />
            <span
              class="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{ currencySymbol }}
            </span>
          </div>
        </div>
      </div>

      <!-- Итог строки -->
      <div>
        <label
          for="item-editor-total"
          class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block"
        >
          Итог строки
        </label>
        <div class="relative">
          <input
            id="item-editor-total"
            :value="lineTotal"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            class="w-full h-11 pl-3 pr-12 rounded-xl bg-primary/5 border border-primary/20 text-body font-bold text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 tabular-nums"
            @input="handleTotalInput"
            @keydown.enter.prevent="handleSave"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-primary/60">
            {{ currencySymbol }}
          </span>
        </div>
        <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark mt-1">
          Правка итога пересчитает цену за единицу
        </p>
      </div>

      <!-- Второстепенные действия -->
      <div class="flex gap-2">
        <UButton v-if="canSplit" variant="ghost" size="md" class="flex-1" @click="handleSplit">
          <UIcon name="call_split" size="sm" class="mr-1.5" />
          Разделить
        </UButton>
        <UButton variant="ghost" size="md" class="flex-1 text-danger" @click="handleDelete">
          <UIcon name="delete" size="sm" class="mr-1.5" />
          Удалить
        </UButton>
      </div>
    </div>

    <template #actions>
      <UButton variant="primary" size="lg" full-width @click="handleSave">Готово</UButton>
    </template>
  </UModal>
</template>
