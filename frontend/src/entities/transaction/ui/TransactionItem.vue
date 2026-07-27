<script setup lang="ts">
import { computed, inject } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { formatRelativeDate } from '@/shared/lib/format/date';
import { getCategoryById as getCategoryByIdStatic } from '@/entities/category';
import type { Category } from '@/entities/category';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { TRANSFER_COLOR } from '@/shared/config/colors';
import { getAmountLines } from '../lib/amountLines';
import type { Transaction } from '../model/types';

const props = defineProps<{
  transaction: Transaction;
  currency?: string;
  accountName?: string;
  toAccountName?: string;
  viewingAccountId?: string;
  balanceAfter?: number;
  hidden?: boolean;
}>();
defineEmits<{
  click: [];
}>();
// Get getCategoryById from App.vue or fallback to static
const injectedGetCategoryById = inject<(id: string) => Category | undefined>('getCategoryById');
const getCategoryById = (id: string): Category | undefined => {
  return injectedGetCategoryById?.(id) ?? getCategoryByIdStatic(id);
};

const category = computed(() => getCategoryById(props.transaction.category_id));

const isTransfer = computed(() => props.transaction.type === 'transfer');
const isAdjustment = computed(() => props.transaction.type === 'adjustment');
const isInformational = computed(() => !!props.transaction.is_informational);

const isIncomingTransfer = computed(
  () =>
    isTransfer.value &&
    props.viewingAccountId &&
    props.transaction.to_account_id === props.viewingAccountId,
);

const transferLabel = computed(() => {
  if (!isTransfer.value) return '';
  const from = props.accountName || 'Счёт';
  const to = props.toAccountName || 'Счёт';

  if (props.viewingAccountId) {
    if (isIncomingTransfer.value) {
      return `← ${from}`;
    }
    return `→ ${to}`;
  }

  return `${from} → ${to}`;
});

// Use net_amount for expenses if available, otherwise use amount
const displayAmount = computed(() => {
  if (props.transaction.type === 'expense' && props.transaction.net_amount !== undefined) {
    return props.transaction.net_amount;
  }
  return props.transaction.amount;
});

const MASKED_AMOUNT = '••••';

const formattedAmount = computed(() => {
  if (props.hidden) return MASKED_AMOUNT;
  const compact = COMPACT_FORMAT;
  if (isInformational.value) {
    const curr = props.transaction.currency || props.currency || DEFAULT_CURRENCY;
    return formatCurrency(props.transaction.amount, curr, compact);
  }
  if (isTransfer.value) {
    if (props.viewingAccountId) {
      if (isIncomingTransfer.value) {
        const amount = props.transaction.to_amount ?? props.transaction.amount;
        const curr =
          props.transaction.to_currency || props.transaction.currency || DEFAULT_CURRENCY;
        return `+${formatCurrency(amount, curr, compact)}`;
      }
      const curr = props.transaction.currency || props.currency || DEFAULT_CURRENCY;
      return `-${formatCurrency(props.transaction.amount, curr, compact)}`;
    }
    const curr = props.transaction.currency || props.currency || DEFAULT_CURRENCY;
    return formatCurrency(props.transaction.amount, curr, compact);
  }

  if (isAdjustment.value) {
    const prefix = props.transaction.is_debt_related ? '-' : '+';
    const curr = props.transaction.currency || props.currency || DEFAULT_CURRENCY;
    return `${prefix}${formatCurrency(props.transaction.amount, curr, compact)}`;
  }

  const prefix = props.transaction.type === 'income' ? '+' : '-';
  const curr = props.transaction.currency || props.currency || DEFAULT_CURRENCY;
  return `${prefix}${formatCurrency(displayAmount.value, curr, compact)}`;
});

const displayCurrency = computed(
  () => props.transaction.currency || props.currency || DEFAULT_CURRENCY,
);

const formattedDate = computed(() =>
  formatRelativeDate(new Date(props.transaction.date).getTime()),
);

// Из этого же расчёта виртуализированный список берёт высоту слота под строку
const amountLines = computed(() =>
  getAmountLines(props.transaction, {
    viewingAccountId: props.viewingAccountId,
    balanceAfter: props.balanceAfter,
  }),
);

const formattedConvertedAmount = computed(() => {
  const currency = props.transaction.to_currency;
  if (!currency) return '';
  return formatCurrency(props.transaction.to_amount || 0, currency, COMPACT_FORMAT);
});

const formattedOriginalAmount = computed(
  () => `-${formatCurrency(props.transaction.amount, displayCurrency.value, COMPACT_FORMAT)}`,
);

const formattedBalanceAfter = computed(() =>
  props.balanceAfter === undefined
    ? ''
    : formatCurrency(props.balanceAfter, displayCurrency.value, COMPACT_FORMAT),
);
</script>

<template>
  <button
    class="w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-150 hover:bg-surface-light dark:hover:bg-surface-dark active:opacity-80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
    :class="{ 'opacity-60': isInformational }"
    :aria-label="`${isTransfer ? 'Перевод' : category?.name || 'Транзакция'}, ${formattedAmount}`"
    @click="$emit('click')"
  >
    <!-- Category/Transfer Icon -->
    <div
      class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
      :style="{
        backgroundColor: isTransfer ? `${TRANSFER_COLOR}12` : `${category?.color || '#64748b'}12`,
      }"
    >
      <UIcon
        :name="isTransfer ? 'swap_horiz' : category?.icon || 'receipt_long'"
        size="sm"
        :style="{
          color: isTransfer ? TRANSFER_COLOR : category?.color || '#64748b',
        }"
      />
    </div>

    <!-- Content -->
    <div class="flex-1 text-left min-w-0">
      <p
        class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate flex items-center gap-1"
      >
        <span class="truncate">
          {{ isTransfer ? 'Перевод' : category?.name || 'Транзакция' }}
        </span>
        <span
          v-if="isInformational"
          class="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-warning"
        >
          <UIcon name="volunteer_activism" size="xs" />
          Информационно
        </span>
      </p>
      <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark truncate">
        <template v-if="isTransfer">{{ transferLabel }}</template>
        <template v-else>
          <span v-if="accountName">{{ accountName }}</span>
          <span v-if="accountName && (transaction.description || formattedDate)">·</span>
          <span>{{ transaction.description || formattedDate }}</span>
        </template>
      </p>
    </div>

    <!-- Amount -->
    <div class="text-right shrink-0">
      <p
        class="text-sm font-semibold"
        :class="[
          isInformational
            ? 'italic text-text-tertiary-light dark:text-text-tertiary-dark'
            : isAdjustment
              ? transaction.is_debt_related
                ? 'text-danger'
                : 'text-success'
              : isTransfer
                ? viewingAccountId
                  ? isIncomingTransfer
                    ? 'text-success'
                    : 'text-danger'
                  : 'text-primary'
                : transaction.type === 'income'
                  ? 'text-success'
                  : 'text-text-primary-light dark:text-text-primary-dark',
        ]"
      >
        {{ formattedAmount }}
      </p>
      <!-- Conversion for multi-currency transfers -->
      <p
        v-if="amountLines.conversion"
        class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        → {{ hidden ? MASKED_AMOUNT : formattedConvertedAmount }}
      </p>
      <!-- Original amount indicator when there are debt returns -->
      <p
        v-if="amountLines.originalAmount"
        class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark line-through"
      >
        {{ hidden ? MASKED_AMOUNT : formattedOriginalAmount }}
      </p>
      <!-- Balance after transaction -->
      <p
        v-if="amountLines.balanceAfter"
        class="text-caption-sm text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        = {{ hidden ? MASKED_AMOUNT : formattedBalanceAfter }}
      </p>
    </div>
  </button>
</template>
