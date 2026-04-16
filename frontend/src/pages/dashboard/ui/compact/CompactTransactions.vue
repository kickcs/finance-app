<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import type { Transaction } from '@/entities/transaction';
import { TRANSFER_COLOR, FALLBACK_CATEGORY_COLOR } from '@/shared/config/colors';
import { useDashboardContext } from '../../model/dashboardContext';
import {
  SECTION_LABEL_CLASS,
  VIEW_ALL_BTN_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  iconTileStyle,
} from './constants';
import CompactRowSkeleton from './CompactRowSkeleton.vue';

const { recentTransactions, recentTxLoading, currency, isHidden, nav, getCategoryById } =
  useDashboardContext();

const COMPACT_TX_LIMIT = 5;

interface TxView {
  tx: Transaction;
  icon: string;
  color: string;
  name: string;
  amountClass: string;
  amountText: string;
  ariaLabel: string;
}

function buildTxCategory(tx: Transaction): { icon: string; color: string; name: string } {
  if (tx.type === 'transfer') {
    return { icon: 'swap_horiz', color: TRANSFER_COLOR, name: 'Перевод' };
  }
  const cat = getCategoryById(tx.category_id);
  return {
    icon: cat?.icon ?? 'receipt_long',
    color: cat?.color ?? FALLBACK_CATEGORY_COLOR,
    name: cat?.name ?? 'Транзакция',
  };
}

function buildTxAmount(tx: Transaction): string {
  const curr = tx.currency || currency.value;
  if (tx.type === 'transfer') return formatCurrency(tx.amount, curr, COMPACT_FORMAT);
  if (tx.type === 'adjustment') {
    const sign = tx.is_debt_related ? '-' : '+';
    return `${sign}${formatCurrency(tx.amount, curr, COMPACT_FORMAT)}`;
  }
  const amount = tx.type === 'expense' && tx.net_amount !== undefined ? tx.net_amount : tx.amount;
  const prefix = tx.type === 'income' ? '+' : '−';
  return `${prefix}${formatCurrency(amount, curr, COMPACT_FORMAT)}`;
}

function buildTxAmountClass(tx: Transaction): string {
  switch (tx.type) {
    case 'income':
      return 'text-success';
    case 'transfer':
      return 'text-primary';
    case 'adjustment':
      return tx.is_debt_related ? 'text-danger' : 'text-success';
    default:
      return 'text-text-primary-light dark:text-text-primary-dark';
  }
}

const compactTransactions = computed<TxView[]>(() =>
  recentTransactions.value.slice(0, COMPACT_TX_LIMIT).map((tx) => {
    const category = buildTxCategory(tx);
    const amountText = buildTxAmount(tx);
    return {
      tx,
      ...category,
      amountClass: buildTxAmountClass(tx),
      amountText,
      ariaLabel: `Транзакция ${category.name}, ${amountText}`,
    };
  }),
);
</script>

<template>
  <section data-testid="compact-transactions" :class="SECTION_CARD_CLASS">
    <div :class="SECTION_HEADER_CLASS">
      <p :class="SECTION_LABEL_CLASS">Недавние</p>
      <button
        v-if="compactTransactions.length > 0"
        type="button"
        :class="VIEW_ALL_BTN_CLASS"
        @click="nav.toHistory"
      >
        Все
      </button>
    </div>
    <CompactRowSkeleton v-if="recentTxLoading" :count="4" />
    <template v-else-if="compactTransactions.length === 0">
      <button
        type="button"
        aria-label="Добавить транзакцию"
        class="w-full flex items-center justify-center gap-2 px-3 py-4 text-sm font-medium text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary transition-colors"
        @click="nav.toNewTransaction()"
      >
        <UIcon name="add" size="sm" />
        <span>Добавить первую транзакцию</span>
      </button>
    </template>
    <template v-else>
      <button
        v-for="(view, index) in compactTransactions"
        :key="view.tx.id"
        type="button"
        :aria-label="view.ariaLabel"
        class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:opacity-80"
        :class="{ 'border-t border-border-light dark:border-border-dark': index !== 0 }"
        @click="nav.toHistory"
      >
        <div
          class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
          :style="iconTileStyle(view.color)"
        >
          <UIcon :name="view.icon" size="xs" :style="{ color: view.color }" />
        </div>
        <span
          class="flex-1 text-body-sm font-semibold truncate text-text-primary-light dark:text-text-primary-dark"
        >
          {{ view.tx.description || view.name }}
        </span>
        <span class="text-body-sm font-bold tabular-nums shrink-0" :class="view.amountClass">
          <template v-if="isHidden">••••</template>
          <template v-else>{{ view.amountText }}</template>
        </span>
      </button>
    </template>
  </section>
</template>
