<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import TransactionItem from './TransactionItem.vue'
import { SwipeableItem, EmptyState } from '@/shared/ui'
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency'
import type { Transaction, TransactionGroup } from '../model/types'

interface HeaderData {
  date: string
  total: number
}

interface FlatItem {
  type: 'header' | 'transaction'
  data: Transaction | HeaderData
  key: string
}

const props = withDefaults(
  defineProps<{
    groups: TransactionGroup[]
    currency?: string
    hasNextPage?: boolean
    isFetchingNextPage?: boolean
    getAccountName?: (id: string | null) => string
    height?: string
    /** Enable swipe actions on transaction items */
    swipeEnabled?: boolean
  }>(),
  {
    currency: 'UZS',
    hasNextPage: false,
    isFetchingNextPage: false,
    height: 'calc(100vh - 320px)',
    swipeEnabled: true,
  },
)

const emit = defineEmits<{
  loadMore: []
  transactionClick: [transaction: Transaction]
  transactionEdit: [transaction: Transaction]
  transactionDelete: [transaction: Transaction]
}>()

const parentRef = ref<HTMLElement | null>(null)

// Flatten groups into single array with type markers
const flatItems = computed<FlatItem[]>(() => {
  const items: FlatItem[] = []
  for (const group of props.groups) {
    items.push({
      type: 'header',
      data: { date: group.date, total: group.total },
      key: `header-${group.date}`,
    })
    for (const tx of group.transactions) {
      items.push({
        type: 'transaction',
        data: tx,
        key: `tx-${tx.id}`,
      })
    }
  }
  return items
})

// Heights
const HEADER_HEIGHT = 44
const TRANSACTION_HEIGHT = 72
const LOADING_HEIGHT = 48

const rowCount = computed(() =>
  props.hasNextPage ? flatItems.value.length + 1 : flatItems.value.length,
)

// Dynamic size based on item type
const getItemSize = (index: number) => {
  if (index >= flatItems.value.length) return LOADING_HEIGHT
  return flatItems.value[index].type === 'header' ? HEADER_HEIGHT : TRANSACTION_HEIGHT
}

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rowCount.value,
    getScrollElement: () => parentRef.value,
    estimateSize: getItemSize,
    overscan: 5,
  })),
)

const virtualRows = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

// Trigger load more when near the end
watchEffect(() => {
  const items = virtualRows.value
  const [lastItem] = [...items].reverse()

  if (!lastItem) return

  if (
    lastItem.index >= flatItems.value.length - 1 &&
    props.hasNextPage &&
    !props.isFetchingNextPage
  ) {
    emit('loadMore')
  }
})

function getItem(index: number): FlatItem | undefined {
  return flatItems.value[index]
}

function isHeaderItem(index: number): boolean {
  const item = getItem(index)
  return item?.type === 'header'
}

function getHeaderData(index: number): HeaderData | null {
  const item = getItem(index)
  if (item?.type === 'header') {
    return item.data as HeaderData
  }
  return null
}

function getTransactionData(index: number): Transaction | null {
  const item = getItem(index)
  if (item?.type === 'transaction') {
    return item.data as Transaction
  }
  return null
}

// Helper functions for rounded corners
function isFirstInGroup(index: number): boolean {
  if (index === 0) return false // First item is always a header
  const item = getItem(index)
  if (!item || item.type !== 'transaction') return false
  // Check if previous item is a header
  const prevItem = getItem(index - 1)
  return prevItem?.type === 'header'
}

function isLastInGroup(index: number): boolean {
  const item = getItem(index)
  if (!item || item.type !== 'transaction') return false
  // Check if next item is a header or end
  const nextItem = getItem(index + 1)
  return !nextItem || nextItem.type === 'header'
}
</script>

<template>
  <div
    ref="parentRef"
    class="overflow-auto"
    :style="{ height }"
  >
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
        <!-- Loading indicator -->
        <div
          v-if="virtualRow.index >= flatItems.length"
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

        <!-- Date header -->
        <div
          v-else-if="isHeaderItem(virtualRow.index)"
          class="flex items-center justify-between px-1 h-full pt-2"
        >
          <span class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
            {{ getHeaderData(virtualRow.index)?.date }}
          </span>
          <span
            class="text-sm font-medium"
            :class="(getHeaderData(virtualRow.index)?.total ?? 0) >= 0 ? 'text-success' : 'text-danger'"
          >
            {{ (getHeaderData(virtualRow.index)?.total ?? 0) >= 0 ? '+' : '' }}{{ formatCurrency(getHeaderData(virtualRow.index)?.total ?? 0, currency, COMPACT_FORMAT) }}
          </span>
        </div>

        <!-- Transaction item -->
        <div
          v-else
          :class="{
            'rounded-t-2xl overflow-hidden': isFirstInGroup(virtualRow.index),
            'rounded-b-2xl overflow-hidden': isLastInGroup(virtualRow.index),
          }"
        >
          <SwipeableItem
            v-if="getTransactionData(virtualRow.index) && swipeEnabled"
            @action-left="emit('transactionDelete', getTransactionData(virtualRow.index)!)"
            @action-right="emit('transactionEdit', getTransactionData(virtualRow.index)!)"
          >
            <TransactionItem
              :transaction="getTransactionData(virtualRow.index)!"
              :currency="currency"
              :account-name="getAccountName?.(getTransactionData(virtualRow.index)!.account_id)"
              :to-account-name="getAccountName?.(getTransactionData(virtualRow.index)?.to_account_id ?? null)"
              @click="emit('transactionClick', getTransactionData(virtualRow.index)!)"
            />
          </SwipeableItem>
          <div v-else-if="getTransactionData(virtualRow.index)" class="bg-card-light dark:bg-card-dark">
            <TransactionItem
              :transaction="getTransactionData(virtualRow.index)!"
              :currency="currency"
              :account-name="getAccountName?.(getTransactionData(virtualRow.index)!.account_id)"
              :to-account-name="getAccountName?.(getTransactionData(virtualRow.index)?.to_account_id ?? null)"
              @click="emit('transactionClick', getTransactionData(virtualRow.index)!)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-if="groups.length === 0 && !isFetchingNextPage"
      icon="receipt_long"
      title="Нет транзакций"
      description="Добавьте первую транзакцию, чтобы начать отслеживать финансы"
    />
  </div>
</template>
