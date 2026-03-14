<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UButton, UIcon, UModal } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { calcSplitAmounts } from '../model/calcLineTotal';
import type { ReceiptItem } from '../model/types';

const props = defineProps<{
  open: boolean;
  item: ReceiptItem | null;
  currency: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [firstQty: number];
}>();

const splitFirstQty = ref(0);

const splitSecondQty = computed(() => {
  if (!props.item) return 0;
  return props.item.qty - splitFirstQty.value;
});

const splitValid = computed(() => {
  return splitFirstQty.value > 0 && splitSecondQty.value > 0;
});

const splitPreviewAmounts = computed(() => {
  if (!props.item || !splitValid.value) return [0, 0] as [number, number];
  return calcSplitAmounts(props.item, splitFirstQty.value);
});

watch(
  () => props.item,
  (item) => {
    if (item) {
      splitFirstQty.value = Math.floor(item.qty / 2);
    }
  },
);
</script>

<template>
  <UModal
    :model-value="open"
    title="Разделить позицию"
    @update:model-value="emit('update:open', $event)"
  >
    <div v-if="item" class="space-y-4">
      <!-- Item being split -->
      <div class="px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark">
        <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ item.name }}
        </p>
        <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
          Количество: {{ item.qty }}
        </p>
      </div>

      <!-- First part input -->
      <div>
        <label
          class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block"
        >
          Первая часть
        </label>
        <input
          v-model.number="splitFirstQty"
          type="number"
          inputmode="decimal"
          step="0.01"
          min="0.01"
          :max="item.qty - 0.01"
          class="w-full px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-medium text-text-primary-light dark:text-text-primary-dark outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 tabular-nums"
        />
      </div>

      <!-- Second part (auto-calculated) -->
      <div>
        <label
          class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block"
        >
          Вторая часть
        </label>
        <div
          class="w-full px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-medium tabular-nums"
          :class="
            splitSecondQty > 0
              ? 'text-text-primary-light dark:text-text-primary-dark'
              : 'text-danger'
          "
        >
          {{ splitSecondQty > 0 ? splitSecondQty : 'Некорректное значение' }}
        </div>
      </div>

      <!-- Preview of amounts -->
      <div
        v-if="splitValid"
        class="space-y-1.5 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/10"
      >
        <div class="flex justify-between text-xs">
          <span class="text-text-secondary-light dark:text-text-secondary-dark">
            Часть 1 ({{ splitFirstQty }})
          </span>
          <span
            class="font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums"
          >
            {{ formatCurrency(splitPreviewAmounts[0], currency) }}
          </span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-text-secondary-light dark:text-text-secondary-dark">
            Часть 2 ({{ splitSecondQty }})
          </span>
          <span
            class="font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums"
          >
            {{ formatCurrency(splitPreviewAmounts[1], currency) }}
          </span>
        </div>
      </div>
    </div>

    <template #actions>
      <UButton
        variant="primary"
        size="lg"
        full-width
        :disabled="!splitValid"
        @click="emit('confirm', splitFirstQty)"
      >
        <UIcon name="call_split" size="sm" class="mr-2" />
        Разделить
      </UButton>
    </template>
  </UModal>
</template>
