<script setup lang="ts">
import { formatCurrency } from '@/shared/lib/format/currency';
import type { PaymentPartView } from '../model/types';
import PaymentSplitBar from './PaymentSplitBar.vue';

/** Операция, оплаченная с двух счетов, только для чтения: полоска, обе части и итог. */
defineProps<{
  parts: [PaymentPartView, PaymentPartView];
  total: number;
  currency: string;
}>();
</script>

<template>
  <div class="space-y-3" data-testid="payment-parts-summary">
    <PaymentSplitBar :segments="parts" />
    <dl class="space-y-1.5 text-sm">
      <div v-for="(part, i) in parts" :key="i" class="flex items-center justify-between gap-3">
        <dt
          class="flex min-w-0 items-center gap-2 text-text-secondary-light dark:text-text-secondary-dark"
        >
          <span
            class="h-2 w-2 shrink-0 rounded-full"
            :class="!part.color && 'bg-text-tertiary-light dark:bg-text-tertiary-dark'"
            :style="part.color ? { backgroundColor: part.color } : undefined"
          />
          <span class="truncate">{{ part.label }}</span>
        </dt>
        <dd
          class="shrink-0 font-medium tabular-nums text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(part.amount, currency) }}
        </dd>
      </div>
      <div
        class="flex items-center justify-between gap-3 border-t border-border-light pt-1.5 dark:border-border-dark"
      >
        <dt class="text-text-secondary-light dark:text-text-secondary-dark">Всего</dt>
        <dd
          class="shrink-0 font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(total, currency) }}
        </dd>
      </div>
    </dl>
  </div>
</template>
