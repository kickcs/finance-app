<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, SwipeableItem } from '@/shared/ui';
import {
  formatCurrency,
  formatNumberWithSpaces,
  getCurrencySymbol,
} from '@/shared/lib/format/currency';
import { cn } from '@/shared/lib/utils';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { calcLineTotal } from '../model/calcLineTotal';
import type { ReceiptItem } from '../model/types';

const props = defineProps<{
  item: ReceiptItem;
  index: number;
  currency: string;
  isInvalid?: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
  split: [];
}>();

const isDesktop = useIsDesktop();

const currencySymbol = computed(() => getCurrencySymbol(props.currency));
const lineTotal = computed(() => calcLineTotal(props.item));
const hasName = computed(() => props.item.name.trim().length > 0);
</script>

<template>
  <SwipeableItem
    class="border-b border-dashed border-border-light dark:border-border-dark"
    :left-action="{ icon: 'delete', color: '#ef4444', label: 'Удалить' }"
    :right-action="{ icon: 'call_split', color: '#8b5cf6', label: 'Разделить' }"
    @action-left="emit('delete')"
    @action-right="emit('split')"
  >
    <button
      type="button"
      :aria-label="`Изменить позицию ${index + 1}: ${item.name || 'без названия'}`"
      :class="
        cn(
          'relative w-full text-left px-4 py-3',
          'active:bg-surface-light dark:active:bg-surface-dark transition-colors duration-100',
          props.isInvalid && 'bg-danger-light',
        )
      "
      @click="emit('edit')"
    >
      <div class="flex items-center gap-3">
        <span
          :class="
            cn(
              'text-caption-sm font-mono font-semibold tabular-nums shrink-0 w-5',
              props.isInvalid
                ? 'text-danger'
                : 'text-text-tertiary-light dark:text-text-tertiary-dark',
            )
          "
        >
          {{ String(index + 1).padStart(2, '0') }}
        </span>

        <div class="flex-1 min-w-0">
          <p
            :class="
              cn(
                'text-body-sm font-medium truncate',
                hasName
                  ? 'text-text-primary-light dark:text-text-primary-dark'
                  : 'text-text-tertiary-light dark:text-text-tertiary-dark italic',
              )
            "
          >
            {{ hasName ? item.name : 'Без названия' }}
          </p>
          <p
            class="text-caption font-mono text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums"
          >
            {{ item.qty }} × {{ formatNumberWithSpaces(item.unitPrice) }} {{ currencySymbol }}
          </p>
        </div>

        <span
          class="text-body-sm font-mono font-semibold tabular-nums shrink-0 text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(lineTotal, currency) }}
        </span>

        <!-- Desktop action buttons -->
        <div v-if="isDesktop" class="flex items-center gap-0.5 shrink-0">
          <span
            role="button"
            tabindex="0"
            :aria-label="`Разделить позицию ${index + 1}`"
            class="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary hover:bg-primary/5 active:scale-90 transition-all"
            @click.stop="emit('split')"
            @keydown.enter.stop.prevent="emit('split')"
          >
            <UIcon name="call_split" size="xs" />
          </span>
          <span
            role="button"
            tabindex="0"
            :aria-label="`Удалить позицию ${index + 1}`"
            class="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger hover:bg-danger/5 active:scale-90 transition-all"
            @click.stop="emit('delete')"
            @keydown.enter.stop.prevent="emit('delete')"
          >
            <UIcon name="delete" size="xs" />
          </span>
        </div>
        <UIcon
          v-else
          name="chevron_right"
          size="xs"
          class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
        />
      </div>
    </button>
  </SwipeableItem>
</template>
