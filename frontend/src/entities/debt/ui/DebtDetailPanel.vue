<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, USpinner } from '@/shared/ui';
import { useDebts } from '../api/useDebts';
import { useDebtTransactions } from '../api/useDebtTransactions';
import { useAccounts } from '@/entities/account';
import DebtDetailContent from './DebtDetailContent.vue';

const props = defineProps<{
  debtId: string;
  userId: string;
}>();

defineEmits<{
  payment: [];
  edit: [];
  delete: [];
  'toggle-private': [value: boolean];
}>();

// Get debts and accounts
const { debts, isLoading } = useDebts(() => props.userId);
const { accounts } = useAccounts(() => props.userId);

// Load transactions for this debt
const { transactions, isLoading: transactionsLoading } = useDebtTransactions(
  computed(() => props.debtId),
);

// Find current debt
const debt = computed(() => {
  return debts.value.find((d) => d.id === props.debtId) ?? null;
});
</script>

<template>
  <div class="py-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <USpinner />
    </div>

    <!-- Not Found State -->
    <div
      v-else-if="!debt"
      class="flex flex-col items-center justify-center py-12 text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      <UIcon name="error" size="lg" class="mb-2" />
      <p class="text-body-sm">Долг не найден</p>
    </div>

    <!-- Debt Details -->
    <DebtDetailContent
      v-else
      :debt="debt"
      :transactions="transactions"
      :accounts="accounts"
      :transactions-loading="transactionsLoading"
      @payment="$emit('payment')"
      @edit="$emit('edit')"
      @delete="$emit('delete')"
      @toggle-private="$emit('toggle-private', $event)"
    />
  </div>
</template>
