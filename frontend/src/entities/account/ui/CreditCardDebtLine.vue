<script setup lang="ts">
import { formatCurrency } from '@/shared/lib/format/currency';

defineProps<{ amount: number; currency: string }>();
</script>

<template>
  <p v-if="amount > 0" data-testid="credit-card-debt-line" class="text-xs text-danger tabular-nums">
    в т.ч. долг по картам −{{ formatCurrency(amount, currency) }}
  </p>
</template>
