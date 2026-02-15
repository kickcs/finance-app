<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import TransactionItem from './TransactionItem.vue';
import { EmptyState } from '@/shared/ui';
import type { Transaction } from '../model/types';

const props = withDefaults(
  defineProps<{
    transactions: Transaction[];
    currency?: string;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    viewingAccountId?: string;
    getAccountName?: (id: string | null) => string;
    height?: string;
  }>(),
  {
    currency: 'UZS',
    hasNextPage: false,
    isFetchingNextPage: false,
    height: 'calc(100vh - 280px)',
  },
);

const emit = defineEmits<{
  loadMore: [];
  transactionClick: [transaction: Transaction];
}>();

const parentRef = ref<HTMLElement | null>(null);

// Estimated height for transaction item
const ITEM_HEIGHT = 72;
const LOADING_HEIGHT = 48;

const rowCount = computed(() =>
  props.hasNextPage ? props.transactions.length + 1 : props.transactions.length,
);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rowCount.value,
    getScrollElement: () => parentRef.value,
    estimateSize: (index: number) =>
      index >= props.transactions.length ? LOADING_HEIGHT : ITEM_HEIGHT,
    overscan: 5,
  })),
);

const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

// Trigger load more when last item is visible
watchEffect(() => {
  const items = virtualRows.value;
  const [lastItem] = [...items].reverse();

  if (!lastItem) return;

  if (
    lastItem.index >= props.transactions.length - 1 &&
    props.hasNextPage &&
    !props.isFetchingNextPage
  ) {
    emit('loadMore');
  }
});
</script>

<template>
  <div ref="parentRef" class="overflow-auto" :style="{ height }">
    <div
      :style="{
        height: `${totalSize}px`,
        width: '100%',
        position: 'relative',
      }"
    >
      <div
        v-for="virtualRow in virtualRows"
        :key="virtualRow.index"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`,
        }"
      >
        <!-- Loading indicator for last row -->
        <div
          v-if="virtualRow.index >= transactions.length"
          class="flex items-center justify-center h-full"
        >
          <span
            v-if="hasNextPage"
            class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
          >
            <span class="inline-block animate-pulse">Загрузка...</span>
          </span>
          <span
            v-else
            class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Все транзакции загружены
          </span>
        </div>

        <!-- Transaction item -->
        <TransactionItem
          v-else
          :transaction="transactions[virtualRow.index]"
          :currency="currency"
          :viewing-account-id="viewingAccountId"
          :account-name="
            getAccountName?.(transactions[virtualRow.index].account_id)
          "
          :to-account-name="
            getAccountName?.(
              transactions[virtualRow.index].to_account_id ?? null,
            )
          "
          @click="emit('transactionClick', transactions[virtualRow.index])"
        />
      </div>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-if="transactions.length === 0 && !isFetchingNextPage"
      icon="receipt_long"
      title="Нет транзакций"
      description="Добавьте первую транзакцию, чтобы начать отслеживать финансы"
    />
  </div>
</template>
