<script setup lang="ts">
import { computed, inject } from 'vue';
import { UIcon, UButton } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatLocalDate } from '@/shared/lib/format/date';
import { getCategoryById as getCategoryByIdStatic } from '@/entities/category';
import type { Category } from '@/entities/category';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { TRANSFER_COLOR } from '@/shared/config/colors';
import type { Transaction } from '../model/types';

const props = defineProps<{
  transaction: Transaction;
  currency?: string;
  accountName?: string;
  toAccountName?: string;
}>();

defineEmits<{
  edit: [];
  delete: [];
}>();

// Get getCategoryById from App.vue or fallback to static
const injectedGetCategoryById = inject<(id: string) => Category | undefined>('getCategoryById');
const getCategoryById = (id: string): Category | undefined => {
  return injectedGetCategoryById?.(id) ?? getCategoryByIdStatic(id);
};

const category = computed(() => getCategoryById(props.transaction.category_id));

const isTransfer = computed(() => props.transaction.type === 'transfer');
const isAdjustment = computed(() => props.transaction.type === 'adjustment');

const displayCurrency = computed(
  () => props.transaction.currency || props.currency || DEFAULT_CURRENCY,
);

// Use net_amount for expenses if available, otherwise use amount
const displayAmount = computed(() => {
  if (props.transaction.type === 'expense' && props.transaction.net_amount !== undefined) {
    return props.transaction.net_amount;
  }
  return props.transaction.amount;
});

const formattedAmount = computed(() => {
  if (isTransfer.value) {
    return formatCurrency(props.transaction.amount, displayCurrency.value);
  }

  if (isAdjustment.value) {
    const prefix = props.transaction.is_debt_related ? '-' : '+';
    return `${prefix}${formatCurrency(props.transaction.amount, displayCurrency.value)}`;
  }

  const prefix = props.transaction.type === 'income' ? '+' : '-';
  return `${prefix}${formatCurrency(displayAmount.value, displayCurrency.value)}`;
});

const amountColorClass = computed(() => {
  if (isAdjustment.value) {
    return props.transaction.is_debt_related ? 'text-danger' : 'text-success';
  }
  if (isTransfer.value) return 'text-primary';
  if (props.transaction.type === 'income') return 'text-success';
  return 'text-danger';
});

const categoryName = computed(() => {
  if (isTransfer.value) return 'Перевод';
  return category.value?.name || 'Транзакция';
});

const categoryIcon = computed(() => {
  if (isTransfer.value) return 'swap_horiz';
  return category.value?.icon || 'receipt_long';
});

const categoryColor = computed(() => {
  if (isTransfer.value) return TRANSFER_COLOR;
  return category.value?.color || '#64748b';
});

const formattedDate = computed(() => formatLocalDate(props.transaction.date));

const transferLabel = computed(() => {
  if (!isTransfer.value) return '';
  const from = props.accountName || 'Счёт';
  const to = props.toAccountName || 'Счёт';
  return `${from} → ${to}`;
});

// Extract hashtags from description
const hashtags = computed(() => {
  if (!props.transaction.description) return [];
  const matches = props.transaction.description.match(/#[\wа-яА-ЯёЁ]+/g);
  return matches || [];
});

// Description without hashtags
const cleanDescription = computed(() => {
  if (!props.transaction.description) return '';
  return props.transaction.description.replace(/#[\wа-яА-ЯёЁ]+/g, '').trim();
});
</script>

<template>
  <div class="flex flex-col items-center py-8 px-4">
    <!-- Category Icon -->
    <div
      class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
      :style="{
        backgroundColor: `${categoryColor}15`,
      }"
    >
      <UIcon :name="categoryIcon" size="lg" :style="{ color: categoryColor }" />
    </div>

    <!-- Category Name -->
    <p class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
      {{ categoryName }}
    </p>

    <!-- Amount -->
    <p class="text-3xl font-bold mb-6" :class="amountColorClass">
      {{ formattedAmount }}
    </p>

    <!-- Transfer conversion info -->
    <p
      v-if="
        isTransfer && transaction.to_currency && transaction.to_currency !== transaction.currency
      "
      class="-mt-4 mb-6 text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      → {{ formatCurrency(transaction.to_amount || 0, transaction.to_currency) }}
    </p>

    <!-- Original amount when debt returns exist -->
    <p
      v-if="transaction.has_debt_returns && transaction.type === 'expense'"
      class="-mt-4 mb-6 text-sm text-text-tertiary-light dark:text-text-tertiary-dark line-through"
    >
      -{{ formatCurrency(transaction.amount, displayCurrency) }}
    </p>

    <!-- Details Card -->
    <div
      class="w-full max-w-sm space-y-0 rounded-2xl bg-card-light dark:bg-card-dark overflow-hidden"
    >
      <!-- Account -->
      <div
        class="flex items-center justify-between px-4 py-3.5 border-b border-border-light dark:border-border-dark"
      >
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">Счёт</span>
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          <template v-if="isTransfer">{{ transferLabel }}</template>
          <template v-else>{{ accountName || '—' }}</template>
        </span>
      </div>

      <!-- Date -->
      <div
        class="flex items-center justify-between px-4 py-3.5 border-b border-border-light dark:border-border-dark"
      >
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">Дата</span>
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ formattedDate }}
        </span>
      </div>

      <!-- Currency -->
      <div
        class="flex items-center justify-between px-4 py-3.5"
        :class="{
          'border-b border-border-light dark:border-border-dark':
            cleanDescription || hashtags.length > 0,
        }"
      >
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">Валюта</span>
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ displayCurrency }}
        </span>
      </div>

      <!-- Description -->
      <div
        v-if="cleanDescription"
        class="px-4 py-3.5"
        :class="{ 'border-b border-border-light dark:border-border-dark': hashtags.length > 0 }"
      >
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark block mb-1">
          Описание
        </span>
        <p class="text-sm text-text-primary-light dark:text-text-primary-dark">
          {{ cleanDescription }}
        </p>
      </div>

      <!-- Hashtags -->
      <div v-if="hashtags.length > 0" class="px-4 py-3.5">
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark block mb-2">
          Теги
        </span>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="tag in hashtags"
            :key="tag"
            class="inline-block px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-light dark:bg-surface-dark text-primary"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="w-full max-w-sm flex gap-3 mt-6">
      <UButton variant="secondary" class="flex-1" @click="$emit('edit')">
        <UIcon name="edit" size="sm" class="mr-1.5" />
        Редактировать
      </UButton>
      <UButton
        variant="ghost"
        class="!text-danger hover:!bg-danger/10"
        aria-label="Удалить транзакцию"
        @click="$emit('delete')"
      >
        <UIcon name="delete" size="sm" />
      </UButton>
    </div>
  </div>
</template>
