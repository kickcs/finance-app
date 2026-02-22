<script setup lang="ts">
import { BalanceCard } from '@/widgets/balance-card';
import { SaveSpendSection } from '@/widgets/save-spend-section';

defineProps<{
  totalBalance: number;
  currency: string;
  percentChange: number | undefined;
  savedThisMonth: number;
  spentThisMonth: number;
  balanceLoading: boolean;
  statsLoading: boolean;
  isHidden: boolean;
}>();

const emit = defineEmits<{
  'toggle-hidden': [];
  'income-click': [];
  'expense-click': [];
  'income-analytics': [];
  'expense-analytics': [];
}>();
</script>

<template>
  <section class="space-y-6">
    <BalanceCard
      :total-balance="totalBalance"
      :currency="currency"
      :percent-change="percentChange"
      :loading="balanceLoading"
      :hidden="isHidden"
      class="md:hover:-translate-y-1 md:hover:shadow-lg transition-[transform,box-shadow] duration-300"
      @toggle-hidden="emit('toggle-hidden')"
      @income-click="emit('income-click')"
      @expense-click="emit('expense-click')"
    />

    <SaveSpendSection
      :saved-amount="savedThisMonth"
      :spent-amount="spentThisMonth"
      :currency="currency"
      :loading="statsLoading"
      :hidden="isHidden"
      class="md:hover:-translate-y-1 md:hover:shadow-md transition-[transform,box-shadow] duration-300"
      @income-click="emit('income-analytics')"
      @expense-click="emit('expense-analytics')"
    />
  </section>
</template>
