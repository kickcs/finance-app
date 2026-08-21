<script setup lang="ts">
import { computed, ref } from 'vue';
import { UIcon, USpinner, UButton } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { useDebts } from '../api/useDebts';
import { useDebtTransactions } from '../api/useDebtTransactions';
import { useAccounts } from '@/entities/account';
import { getDebtDisplayName } from '../model/types';
import { findClosingRecords } from '../lib/findClosingRecords';
import type { Transaction } from '@/shared/api/database.types';
import DebtDetailContent from './DebtDetailContent.vue';
import DebtActionsSheet from './DebtActionsSheet.vue';

const props = defineProps<{
  debtId: string;
  userId: string;
}>();

const emit = defineEmits<{
  payment: [];
  edit: [];
  delete: [];
  /** Шторка действий живёт здесь, а модалку отмены рисует страница-хост. */
  reopen: [closingRecords: Transaction[]];
  'toggle-private': [value: boolean];
}>();

const { trigger } = useHaptics();

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

// У панели нет `AppHeader`, куда страница унесла имя и действия, — своя
// строка-шапка ниже несёт имя и «Редактировать», остальное открывает шторка.
const isActionsOpen = ref(false);

function openActions() {
  trigger('selection');
  isActionsOpen.value = true;
}

function handleEdit() {
  trigger('selection');
  emit('edit');
}
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

    <template v-else>
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2
          class="min-w-0 truncate text-h3 font-bold text-text-primary-light dark:text-text-primary-dark"
        >
          {{ debt.is_private ? '•••' : getDebtDisplayName(debt) }}
        </h2>

        <div class="flex shrink-0 items-center gap-1">
          <UButton
            v-if="!debt.is_closed"
            variant="ghost"
            size="sm"
            class="!p-2"
            aria-label="Редактировать"
            @click="handleEdit"
          >
            <UIcon name="edit" size="sm" />
          </UButton>
          <UButton
            variant="ghost"
            size="sm"
            class="!p-2"
            aria-label="Ещё"
            data-testid="debt-panel-more-btn"
            @click="openActions"
          >
            <UIcon name="more_horiz" size="sm" />
          </UButton>
        </div>
      </div>

      <DebtActionsSheet
        v-model="isActionsOpen"
        :debt="debt"
        @delete="emit('delete')"
        @reopen="emit('reopen', findClosingRecords(debt, transactions))"
        @toggle-private="emit('toggle-private', $event)"
      />

      <DebtDetailContent
        :debt="debt"
        :transactions="transactions"
        :accounts="accounts"
        :transactions-loading="transactionsLoading"
        @payment="emit('payment')"
      />
    </template>
  </div>
</template>
