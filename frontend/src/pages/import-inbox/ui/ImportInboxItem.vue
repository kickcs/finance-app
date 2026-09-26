<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import type { ImportedTransaction } from '@/entities/imported-transaction';
import { cleanMerchantName } from '../model/inboxGrouping';

const props = defineProps<{
  item: ImportedTransaction;
}>();

defineEmits<{
  click: [];
}>();

const isIncome = computed(() => props.item.type === 'income');

/** Directional icon + accent color, mirroring the transaction list's visual language. */
const visual = computed(() => {
  if (isIncome.value) {
    return {
      icon: 'arrow_downward',
      iconClass: 'text-success',
      bgClass: 'bg-success-light',
    };
  }
  return {
    icon: 'arrow_upward',
    iconClass: 'text-danger',
    bgClass: 'bg-danger-light',
  };
});

/** Заголовок — очищенный от города мерчант, иначе сенсиблфолбэк по типу. */
const title = computed(() => {
  const cleaned = cleanMerchantName(props.item.merchant);
  if (cleaned) return cleaned;
  return isIncome.value ? 'Пополнение' : 'Списание';
});

/** День уже виден в заголовке группы — здесь только время. */
const time = computed(() =>
  formatDate(props.item.occurred_at ?? props.item.created_at, { format: 'time' }),
);

/** Signed, colored amount + currency shown separately (smaller, tertiary). */
const amount = computed(() => {
  const { amount: value, currency } = props.item;

  if (value === null) {
    return {
      text: 'Сумма неизвестна',
      currency: '',
      class: 'text-text-tertiary-light dark:text-text-tertiary-dark',
    };
  }

  const sign = isIncome.value ? '+' : '−';
  return {
    text: `${sign}${formatCurrency(Math.abs(value), currency, { showSymbol: false })}`,
    currency,
    class: isIncome.value ? 'text-success' : 'text-text-primary-light dark:text-text-primary-dark',
  };
});
</script>

<template>
  <button
    type="button"
    class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface-light dark:active:bg-surface-dark focus-ring"
    @click="$emit('click')"
  >
    <!-- Type icon -->
    <div
      :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', visual.bgClass]"
    >
      <UIcon :name="visual.icon" size="sm" :class="visual.iconClass" />
    </div>

    <!-- Details -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">
        {{ title }}
      </p>
      <div
        class="mt-0.5 flex items-center gap-1.5 text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        <span class="shrink-0">{{ item.card_mask }}</span>
        <span aria-hidden="true">·</span>
        <span class="shrink-0">{{ time }}</span>
      </div>
    </div>

    <!-- Amount -->
    <div class="text-right shrink-0">
      <p :class="['text-sm font-semibold tabular-nums', amount.class]">
        {{ amount.text }}
      </p>
      <p
        v-if="amount.currency"
        class="mt-0.5 text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        {{ amount.currency }}
      </p>
    </div>
  </button>
</template>
