<script setup lang="ts">
import { ref, shallowRef, computed, watchEffect } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { useEventListener } from '@vueuse/core';
import TransactionItem from './TransactionItem.vue';
import DayGroupHeader from './DayGroupHeader.vue';
import { SwipeableItem } from '@/shared/ui';
import { getAmountLines } from '../lib/amountLines';
import type { Transaction, TransactionGroup } from '../model/types';

interface HeaderData {
  date: string;
  total: number;
}

interface FlatItem {
  type: 'header' | 'transaction';
  data: Transaction | HeaderData;
  key: string;
  /** Точная высота слота — виртуализатор берёт её как есть */
  size: number;
  /** Смещение от начала списка */
  start: number;
  /** Первая / последняя операция дня — скругление карточки дня */
  isFirst: boolean;
  isLast: boolean;
}

const props = withDefaults(
  defineProps<{
    groups: TransactionGroup[];
    currency?: string;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    getAccountName?: (id: string | null) => string;
    height?: string;
    /** Enable swipe actions on transaction items */
    swipeEnabled?: boolean;
    getBalanceAfter?: (txId: string) => number | undefined;
  }>(),
  {
    currency: 'UZS',
    hasNextPage: false,
    isFetchingNextPage: false,
    height: 'calc(100vh - 320px)',
    swipeEnabled: true,
  },
);

const emit = defineEmits<{
  loadMore: [];
  transactionClick: [transaction: Transaction];
  transactionEdit: [transaction: Transaction];
  transactionDelete: [transaction: Transaction];
}>();

const parentRef = ref<HTMLElement | null>(null);

// --- Высоты -----------------------------------------------------------------
// Строка операции: иконка h-9 (36) + p-3 сверху и снизу (24) = 60.
// Колонка суммы обычно укладывается в те же 36 px (сумма 20 + одна доп. строка 16).
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 60;
// Две дополнительные строки в колонке суммы (зачёркнутая сумма + остаток, либо
// конвертация + остаток) дают 20 + 16 + 16 = 52 px содержимого.
const ROW_HEIGHT_TALL = 76;
const LOADING_HEIGHT = 44;

/**
 * Пропсы, от которых зависит состав колонки суммы, а значит и высота слота.
 * Они же уходят в строку — добавится ещё один, высота учтёт его сама.
 */
function amountLineProps(tx: Transaction) {
  return { balanceAfter: props.getBalanceAfter?.(tx.id) };
}

function transactionItemProps(tx: Transaction) {
  return {
    transaction: tx,
    currency: props.currency,
    accountName: props.getAccountName?.(tx.account_id),
    toAccountName: props.getAccountName?.(tx.to_account_id ?? null),
    ...amountLineProps(tx),
  };
}

// Плоский список со смещениями: одна и та же таблица кормит и виртуализатор,
// и липкий заголовок — второй раз высоты нигде не считаются.
const flatItems = computed<FlatItem[]>(() => {
  const items: FlatItem[] = [];
  let start = 0;

  for (const group of props.groups) {
    items.push({
      type: 'header',
      data: { date: group.date, total: group.total },
      key: `header-${group.date}`,
      size: HEADER_HEIGHT,
      start,
      isFirst: false,
      isLast: false,
    });
    start += HEADER_HEIGHT;

    group.transactions.forEach((tx, i) => {
      // Только опции колонки суммы: имена счетов на высоту не влияют, и
      // разрешать их для всего списка ради высоты незачем
      const size =
        getAmountLines(tx, amountLineProps(tx)).count >= 2 ? ROW_HEIGHT_TALL : ROW_HEIGHT;
      items.push({
        type: 'transaction',
        data: tx,
        key: `tx-${tx.id}`,
        size,
        start,
        isFirst: i === 0,
        isLast: i === group.transactions.length - 1,
      });
      start += size;
    });
  }

  return items;
});

const rowCount = computed(() =>
  props.hasNextPage ? flatItems.value.length + 1 : flatItems.value.length,
);

const getItemSize = (index: number) => flatItems.value[index]?.size ?? LOADING_HEIGHT;

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rowCount.value,
    getScrollElement: () => parentRef.value,
    estimateSize: getItemSize,
    overscan: 5,
  })),
);

const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

// --- Липкий заголовок дня ---------------------------------------------------
// Собственный слушатель скролла, а не scrollOffset виртуализатора: тот уведомляет
// только при смене видимого диапазона (раз в строку), и заголовок отставал бы.
// И не useScroll: тот на каждое событие зовёт getComputedStyle ради arrivedState,
// то есть форсит пересчёт стилей ровно там, где виртуализатор пишет transform.
const scrollY = shallowRef(0);
useEventListener(parentRef, 'scroll', () => (scrollY.value = parentRef.value?.scrollTop ?? 0), {
  passive: true,
});

const dayHeaders = computed(() => flatItems.value.filter((item) => item.type === 'header'));

// Показываем только когда настоящий заголовок уже уехал вверх, иначе один и тот
// же текст рисовался бы дважды в одной точке. У границы дней следующий заголовок
// выталкивает текущий — как в системных списках.
const stickyHeader = computed<{ data: HeaderData; offset: number } | null>(() => {
  const scrollOffset = scrollY.value;
  const headers = dayHeaders.value;

  let currentIdx = -1;
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].start > scrollOffset) break;
    currentIdx = i;
  }

  const current = headers[currentIdx];
  if (!current || scrollOffset <= current.start) return null;

  const nextStart = headers[currentIdx + 1]?.start ?? Number.POSITIVE_INFINITY;
  const gapToNext = nextStart - scrollOffset - HEADER_HEIGHT;
  return { data: current.data as HeaderData, offset: Math.min(0, gapToNext) };
});

// Trigger load more when near the end
watchEffect(() => {
  const items = virtualRows.value;
  const [lastItem] = [...items].reverse();

  if (!lastItem) return;

  if (
    lastItem.index >= flatItems.value.length - 1 &&
    props.hasNextPage &&
    !props.isFetchingNextPage
  ) {
    emit('loadMore');
  }
});

function getItem(index: number): FlatItem | undefined {
  return flatItems.value[index];
}

function getHeaderData(index: number): HeaderData | null {
  const item = getItem(index);
  return item?.type === 'header' ? (item.data as HeaderData) : null;
}

function getTransactionData(index: number): Transaction | null {
  const item = getItem(index);
  return item?.type === 'transaction' ? (item.data as Transaction) : null;
}

/**
 * Смена фильтра — это новый список, а не то же место в старом: страница зовёт
 * это, чтобы прокрутка не оставалась на позиции, которой в новых данных нет.
 */
function scrollToTop() {
  parentRef.value?.scrollTo({ top: 0 });
}

defineExpose({ scrollToTop });
</script>

<template>
  <div class="relative" :style="{ height }">
    <div ref="parentRef" class="h-full overflow-auto">
      <div
        :style="{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }"
      >
        <div
          v-for="virtualRow in virtualRows"
          :key="flatItems[virtualRow.index]?.key ?? `loading-${virtualRow.index}`"
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
              class="text-xs text-text-secondary-light dark:text-text-secondary-dark"
            >
              <span class="inline-block animate-pulse">Загрузка...</span>
            </span>
            <span v-else class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              Все транзакции загружены
            </span>
          </div>

          <!-- Date header -->
          <DayGroupHeader
            v-else-if="getHeaderData(virtualRow.index)"
            :date="getHeaderData(virtualRow.index)!.date"
            :total="getHeaderData(virtualRow.index)!.total"
            :currency="currency"
          />

          <!-- Transaction row: операции одного дня образуют одну карточку -->
          <div
            v-else
            class="relative h-full overflow-hidden bg-card-light dark:bg-card-dark"
            :class="{
              'rounded-t-2xl': flatItems[virtualRow.index].isFirst,
              'rounded-b-2xl': flatItems[virtualRow.index].isLast,
            }"
          >
            <SwipeableItem
              v-if="getTransactionData(virtualRow.index) && swipeEnabled"
              flush
              full-swipe
              @action-left="emit('transactionDelete', getTransactionData(virtualRow.index)!)"
              @action-right="emit('transactionEdit', getTransactionData(virtualRow.index)!)"
            >
              <TransactionItem
                v-bind="transactionItemProps(getTransactionData(virtualRow.index)!)"
                @click="emit('transactionClick', getTransactionData(virtualRow.index)!)"
              />
            </SwipeableItem>
            <TransactionItem
              v-else-if="getTransactionData(virtualRow.index)"
              v-bind="transactionItemProps(getTransactionData(virtualRow.index)!)"
              @click="emit('transactionClick', getTransactionData(virtualRow.index)!)"
            />

            <!-- Волосяной разделитель по левому краю текста -->
            <span
              v-if="!flatItems[virtualRow.index].isFirst"
              aria-hidden="true"
              class="pointer-events-none absolute top-0 left-[3.75rem] right-3 h-px bg-border-light dark:bg-border-dark"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Липкая линейка дня. aria-hidden: настоящий заголовок остаётся в дереве
         доступности, и без этого скринридер читал бы дату и итог дважды. -->
    <div
      v-if="stickyHeader"
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 z-20"
      :style="{ height: `${HEADER_HEIGHT}px`, transform: `translateY(${stickyHeader.offset}px)` }"
    >
      <DayGroupHeader
        sticky
        :date="stickyHeader.data.date"
        :total="stickyHeader.data.total"
        :currency="currency"
      />
    </div>
  </div>
</template>
