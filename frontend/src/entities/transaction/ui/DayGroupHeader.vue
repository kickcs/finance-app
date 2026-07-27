<script setup lang="ts">
import { computed } from 'vue';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';

const props = withDefaults(
  defineProps<{
    date: string;
    total: number;
    currency?: string;
    /** Липкий вариант: непрозрачная подложка, чтобы список уезжал под него */
    sticky?: boolean;
  }>(),
  { currency: 'UZS', sticky: false },
);

const isPositive = computed(() => props.total >= 0);

const formattedTotal = computed(
  () =>
    `${isPositive.value ? '+' : ''}${formatCurrency(props.total, props.currency, COMPACT_FORMAT)}`,
);
</script>

<template>
  <!-- Липкий и обычный варианты выровнены одинаково: в момент, когда липкий
       подменяет уехавший заголовок, текст не должен прыгать. -->
  <div
    class="flex items-end gap-2 px-1 pb-1 h-full"
    :class="sticky ? 'bg-background-light dark:bg-background-dark' : ''"
  >
    <span class="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
      {{ date }}
    </span>
    <!-- Линейка гроссбуха: связывает дату с итогом дня -->
    <span class="flex-1 h-px bg-border-light dark:bg-border-dark" aria-hidden="true" />
    <span
      class="text-xs font-semibold tabular-nums"
      :class="isPositive ? 'text-success' : 'text-danger'"
    >
      {{ formattedTotal }}
    </span>
  </div>
</template>
