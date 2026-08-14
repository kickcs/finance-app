<script setup lang="ts">
import { computed } from 'vue';
import { Skeleton } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import type { Debt, Transaction } from '@/shared/api/database.types';
import { DEBT_DIRECTION_COLORS } from '../model/types';

const props = defineProps<{
  debt: Debt;
  transactions: Transaction[];
  isLoading: boolean;
}>();

const debtColor = computed(() => DEBT_DIRECTION_COLORS[props.debt.debt_type]);

// Filter only payment transactions: exclude the creation transaction AND any
// informational records (forgiveness already gets its own timeline node below).
const paymentTransactions = computed(() => {
  return props.transactions.filter(
    (t) => t.id !== props.debt.transaction_id && !t.is_informational,
  );
});
</script>

<template>
  <div
    class="p-4 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl"
  >
    <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
      История платежей
    </p>

    <!-- Loading state -->
    <div v-if="isLoading" class="space-y-4 pl-5">
      <Skeleton v-for="i in 3" :key="i" class="h-8 rounded-lg" />
    </div>

    <!-- Timeline -->
    <div v-else class="relative pl-5">
      <!-- Vertical line -->
      <div
        class="absolute left-[7px] top-1.5 bottom-1.5 w-0.5 bg-border-light dark:bg-border-dark"
      />

      <!-- Created node -->
      <div class="relative mb-4">
        <div
          class="absolute -left-5 top-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card-light dark:border-card-dark shadow-[0_0_0_2px] shadow-border-light dark:shadow-border-dark"
        />
        <p
          class="flex items-center justify-between gap-3 text-xs font-medium text-text-primary-light dark:text-text-primary-dark"
        >
          <span>Долг создан</span>
          <span class="font-semibold tabular-nums">
            {{ formatCurrency(debt.total_amount, debt.currency) }}
          </span>
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ formatDate(debt.created_at, { format: 'short' }) }}
        </p>
      </div>

      <!-- Empty state when no payments yet -->
      <div v-if="paymentTransactions.length === 0 && !debt.is_closed" class="relative mb-4">
        <div
          class="absolute -left-5 top-0.5 w-2.5 h-2.5 rounded-full bg-border-light dark:bg-border-dark border-2 border-card-light dark:border-card-dark shadow-[0_0_0_2px] shadow-border-light dark:shadow-border-dark"
        />
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark italic">
          Платежей пока нет
        </p>
      </div>

      <!-- Payment nodes -->
      <div v-for="tx in paymentTransactions" :key="tx.id" class="relative mb-4">
        <div
          class="absolute -left-5 top-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-card-light dark:border-card-dark shadow-[0_0_0_2px] shadow-border-light dark:shadow-border-dark"
        />
        <p
          class="flex items-center justify-between gap-3 text-xs font-medium text-text-primary-light dark:text-text-primary-dark"
        >
          <span>Платёж</span>
          <span class="font-semibold tabular-nums text-success">
            +{{ formatCurrency(tx.amount, tx.currency) }}
          </span>
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ formatDate(tx.date || tx.created_at, { format: 'short' }) }}
          <template v-if="tx.description">· {{ tx.description }}</template>
        </p>
      </div>

      <!-- Forgiveness node -->
      <div v-if="debt.forgiven_amount > 0" class="relative mb-4">
        <div
          class="absolute -left-5 top-0.5 w-2.5 h-2.5 rounded-full bg-warning border-2 border-card-light dark:border-card-dark shadow-[0_0_0_2px] shadow-border-light dark:shadow-border-dark"
        />
        <p
          class="flex items-center justify-between gap-3 text-xs font-medium text-text-primary-light dark:text-text-primary-dark"
        >
          <span>Прощено</span>
          <span class="font-semibold tabular-nums text-warning">
            {{ formatCurrency(debt.forgiven_amount, debt.currency) }}
          </span>
        </p>
        <p
          v-if="debt.closed_at"
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {{ formatDate(debt.closed_at, { format: 'short' }) }}
        </p>
      </div>

      <!-- Final node -->
      <div class="relative">
        <div
          v-if="debt.is_closed"
          class="absolute -left-5 top-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-card-light dark:border-card-dark shadow-[0_0_0_2px] shadow-border-light dark:shadow-border-dark"
        />
        <div
          v-else
          class="absolute -left-5 top-0.5 w-2.5 h-2.5 rounded-full bg-card-light dark:bg-card-dark border-2 shadow-[0_0_0_2px] shadow-border-light dark:shadow-border-dark"
          :style="{ borderColor: debtColor }"
        />
        <!-- Остаток не повторяем: он стоит заголовком страницы, а здесь нужен
             только конец ленты — «история на этом не закончилась» -->
        <p
          class="text-xs font-medium"
          :class="debt.is_closed ? 'text-success' : ''"
          :style="!debt.is_closed ? { color: debtColor } : undefined"
        >
          {{ debt.is_closed ? 'Погашен' : 'Ещё не закрыт' }}
        </p>
        <p
          v-if="debt.is_closed && debt.closed_at"
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {{ formatDate(debt.closed_at, { format: 'short' }) }}
        </p>
      </div>
    </div>
  </div>
</template>
