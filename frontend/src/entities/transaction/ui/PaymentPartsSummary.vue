<script setup lang="ts">
import { computed } from 'vue';
import { formatCurrency } from '@/shared/lib/format/currency';
import PaymentSplitBar from './PaymentSplitBar.vue';

/** Операция, оплаченная с двух счетов, только для чтения: полоска, обе части и итог. */
const props = defineProps<{
  parts: [Part, Part];
  currency: string;
}>();

interface Part {
  name: string;
  color?: string | null;
  amount: number;
}

// Суммы в валютах с копейками: 0.1 + 0.2 в float даёт 0.30000000000000004.
const total = computed(
  () => Math.round((props.parts[0].amount + props.parts[1].amount) * 100) / 100,
);

const segments = computed(
  () =>
    props.parts.map((p) => ({ label: p.name, amount: p.amount, color: p.color })) as [
      { label: string; amount: number; color?: string | null },
      { label: string; amount: number; color?: string | null },
    ],
);
</script>

<template>
  <div class="space-y-3" data-testid="payment-parts-summary">
    <PaymentSplitBar :segments="segments" />
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
          <span class="truncate">{{ part.name }}</span>
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
