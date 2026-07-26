<script setup lang="ts">
import { computed } from 'vue';
import { formatCurrency } from '@/shared/lib/format/currency';

const props = defineProps<{
  totalGiven: number;
  totalTaken: number;
  currency: string;
}>();

const net = computed(() => props.totalGiven - props.totalTaken);
const isPositive = computed(() => net.value >= 0);
const total = computed(() => props.totalGiven + props.totalTaken);

/**
 * Доля «вам должны» во всей массе долгов. Долг всегда двусторонний, поэтому
 * итог показан не только числом, но и тем, насколько разошлись чаши.
 */
const givenShare = computed(() => (total.value > 0 ? (props.totalGiven / total.value) * 100 : 50));
</script>

<template>
  <div
    data-testid="debts-summary"
    class="rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-5"
  >
    <p
      class="text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      Итог по всем
    </p>

    <p
      data-testid="debts-summary-net"
      class="mt-1 text-h1 font-bold tracking-tight tabular-nums"
      :class="isPositive ? 'text-debt-given' : 'text-debt-received'"
    >
      {{ isPositive ? '+' : '−' }}{{ formatCurrency(Math.abs(net), currency) }}
    </p>

    <div class="mt-4 flex h-1.5 gap-1" aria-hidden="true">
      <div
        class="shrink-0 rounded-full bg-debt-given transition-[width] duration-500 motion-reduce:transition-none"
        :style="{ width: `${givenShare}%` }"
      />
      <div class="flex-1 rounded-full bg-debt-received" />
    </div>

    <div class="mt-3 flex items-start justify-between gap-4">
      <div>
        <p
          class="flex items-center gap-1.5 text-caption text-text-secondary-light dark:text-text-secondary-dark"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-debt-given" />
          Вам должны
        </p>
        <p
          class="mt-0.5 text-body-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(totalGiven, currency) }}
        </p>
      </div>

      <div class="text-right">
        <p
          class="flex items-center justify-end gap-1.5 text-caption text-text-secondary-light dark:text-text-secondary-dark"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-debt-received" />
          Вы должны
        </p>
        <p
          class="mt-0.5 text-body-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(totalTaken, currency) }}
        </p>
      </div>
    </div>
  </div>
</template>
