<script setup lang="ts">
import { BalanceCard } from '@/widgets/balance-card';

defineProps<{
  totalBalance: number;
  currency: string;
  balanceLoading: boolean;
  isHidden: boolean;
}>();

defineEmits<{
  'toggle-hidden': [];
  'balance-click': [];
}>();
</script>

<template>
  <section>
    <BalanceCard
      :total-balance="totalBalance"
      :currency="currency"
      :loading="balanceLoading"
      :hidden="isHidden"
      @toggle-hidden="$emit('toggle-hidden')"
      @balance-click="$emit('balance-click')"
    />
  </section>
</template>
