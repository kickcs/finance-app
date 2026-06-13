<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatRelativeDate } from '@/shared/lib/format/date';
import type { ImportedTransaction } from '@/entities/imported-transaction';

const props = defineProps<{
  item: ImportedTransaction;
}>();

defineEmits<{
  click: [];
}>();

const isBalanceChange = computed(() => props.item.type === 'balance_change');
const isIncome = computed(() => props.item.type === 'income');

/** Directional icon + accent color, mirroring the transaction list's visual language. */
const visual = computed(() => {
  if (isBalanceChange.value) {
    return {
      icon: 'swap_vert',
      iconClass: 'text-primary',
      bgClass: 'bg-primary-light',
    };
  }
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

/** Primary label: merchant when present, otherwise a sensible fallback per type. */
const title = computed(() => {
  if (props.item.merchant) return props.item.merchant;
  if (isBalanceChange.value) return 'Изменение баланса';
  return isIncome.value ? 'Пополнение' : 'Списание';
});

/** Signed, colored amount string. Null amount on balance_change → «Сумма неизвестна». */
const amount = computed(() => {
  const { amount: value, currency } = props.item;

  if (value === null) {
    return {
      text: 'Сумма неизвестна',
      class: 'text-text-tertiary-light dark:text-text-tertiary-dark',
    };
  }

  if (isBalanceChange.value) {
    return {
      text: formatCurrency(value, currency, { showSign: true }),
      class: value >= 0 ? 'text-success' : 'text-danger',
    };
  }

  const signed = isIncome.value ? value : -Math.abs(value);
  return {
    text: formatCurrency(signed, currency, { showSign: true }),
    class: isIncome.value ? 'text-success' : 'text-text-primary-light dark:text-text-primary-dark',
  };
});

const relativeDate = computed(() =>
  props.item.occurred_at ? formatRelativeDate(new Date(props.item.occurred_at)) : '',
);
</script>

<template>
  <button
    type="button"
    class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface-light dark:active:bg-surface-dark"
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
      <div class="flex items-center gap-2">
        <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">
          {{ title }}
        </p>
        <span
          v-if="isBalanceChange && item.merchant"
          class="shrink-0 text-caption-xs font-medium px-1.5 py-0.5 rounded-md bg-primary-light text-primary"
        >
          Изменение баланса
        </span>
      </div>
      <div
        class="mt-0.5 flex items-center gap-1.5 text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        <span class="flex items-center gap-1 truncate">
          <UIcon
            name="credit_card"
            size="sm"
            class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
          />
          {{ item.card_mask }}
        </span>
        <template v-if="relativeDate">
          <span aria-hidden="true">·</span>
          <span class="shrink-0">{{ relativeDate }}</span>
        </template>
      </div>
    </div>

    <!-- Amount -->
    <div class="text-right shrink-0">
      <p :class="['text-sm font-semibold tabular-nums', amount.class]">
        {{ amount.text }}
      </p>
    </div>

    <UIcon
      name="chevron_right"
      size="sm"
      class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
    />
  </button>
</template>
