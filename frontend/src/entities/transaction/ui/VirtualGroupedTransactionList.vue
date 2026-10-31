<script setup lang="ts">
import { ref, shallowRef, computed, watchEffect } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { onLongPress, useEventListener } from '@vueuse/core';
import TransactionItem from './TransactionItem.vue';
import DayGroupHeader from './DayGroupHeader.vue';
import { SwipeableItem } from '@/shared/ui';
import { trigger } from '@/shared/lib/haptics';
import { cn } from '@/shared/lib/utils';
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
    /** Долгое нажатие на строку начинает выбор (событие `transactionLongPress`) */
    selectable?: boolean;
    /** Режим выбора: свайпы выключены, в строках отметки */
    selectMode?: boolean;
    selectedIds?: ReadonlySet<string>;
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
  transactionLongPress: [transaction: Transaction];
}>();

const parentRef = ref<HTMLElement | null>(null);

// --- Высоты -----------------------------------------------------------------
// Строка операции: иконка h-9 (36) + p-3 сверху и снизу (24) = 60.
// Колонка суммы обычно укладывается в те же 36 px (сумма 20 + одна доп. строка 16).
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 60;
// Каждая следующая дополнительная строка в колонке суммы (зачёркнутая сумма,
// конвертация, «часть из N», остаток) добавляет к слоту по 16 px.
const EXTRA_LINE_HEIGHT = 16;
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
    selectMode: props.selectMode,
    selected: props.selectedIds?.has(tx.id) ?? false,
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
      const extraLines = getAmountLines(tx, amountLineProps(tx)).count;
      const size = ROW_HEIGHT + Math.max(0, extraLines - 1) * EXTRA_LINE_HEIGHT;
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

// Опции пересобираются на любое изменение flatItems, а не только длины.
// virtual-core кэширует измерения и сбрасывает кэш по идентичности getItemKey —
// без этого высота, изменившаяся уже после первой отрисовки (например, остаток
// по счёту появляется, когда догрузились счета), осталась бы старой, и строка
// обрезалась бы по старому слоту до следующей пагинации.
const virtualizer = useVirtualizer(
  computed(() => {
    const items = flatItems.value;
    return {
      count: props.hasNextPage ? items.length + 1 : items.length,
      getScrollElement: () => parentRef.value,
      estimateSize: (index: number) => items[index]?.size ?? LOADING_HEIGHT,
      getItemKey: (index: number) => items[index]?.key ?? `loading-${index}`,
      overscan: 5,
    };
  }),
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

// --- Долгое нажатие ---------------------------------------------------------
// Список без выбора (экран счёта) не должен ни вибрировать, ни глотать клики.
const canLongPress = () => props.selectable && !props.selectMode;

const LONG_PRESS_MS = 450;
// Сдвиг дальше порога — это прокрутка или свайп, а не удержание
const LONG_PRESS_SLOP_PX = 8;

// Клик, которым заканчивается удержание, должен быть проглочен: иначе страница
// тут же снимет отметку, поставленную долгим нажатием.
let swallowNextClick = false;

onLongPress(
  parentRef,
  (event) => {
    if (!canLongPress()) return;
    const id = (event.target as Element | null)?.closest<HTMLElement>('[data-tx-id]')?.dataset.txId;
    const tx = flatItems.value
      .filter((it) => it.type === 'transaction')
      .map((it) => it.data as Transaction)
      .find((it) => it.id === id);
    if (!tx) return;
    swallowNextClick = true;
    trigger('selection');
    emit('transactionLongPress', tx);
  },
  { delay: LONG_PRESS_MS, distanceThreshold: LONG_PRESS_SLOP_PX },
);

// Флаг живёт до следующего касания, а не по таймеру: палец можно держать сколь угодно долго
useEventListener(parentRef, 'pointerdown', () => {
  swallowNextClick = false;
});
useEventListener(
  parentRef,
  'click',
  (event) => {
    if (!swallowNextClick) return;
    swallowNextClick = false;
    event.stopPropagation();
    event.preventDefault();
  },
  { capture: true },
);

// Без этого Android показывает контекстное меню строки, iOS — меню копирования
function onContextMenu(event: Event) {
  if (props.selectable && (event.target as Element).closest('[data-tx-id]')) event.preventDefault();
}

function rowClass(item: FlatItem) {
  return cn(
    'relative h-full overflow-hidden bg-card-light dark:bg-card-dark',
    item.isFirst && 'rounded-t-2xl',
    item.isLast && 'rounded-b-2xl',
    props.selectable && 'select-none [-webkit-touch-callout:none]',
  );
}

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
  <div ref="parentRef" class="overflow-auto" :style="{ height }" @contextmenu="onContextMenu">
    <!-- Липкая линейка дня внутри скроллера: вытолкнутую её обрезает край списка, а не
         рисует поверх чипов. before: на 1 px за край — стык вровень на дробных
         координатах iOS оставлял щель со строками. aria-hidden: дата уже есть в дереве. -->
    <div
      v-if="stickyHeader"
      aria-hidden="true"
      class="pointer-events-none sticky top-0 z-20 before:absolute before:inset-x-0 before:bottom-full before:h-px before:bg-background-light dark:before:bg-background-dark"
      :style="{
        height: `${HEADER_HEIGHT}px`,
        marginBottom: `-${HEADER_HEIGHT}px`,
        transform: `translateY(${stickyHeader.offset}px)`,
      }"
    >
      <DayGroupHeader
        sticky
        :date="stickyHeader.data.date"
        :total="stickyHeader.data.total"
        :currency="currency"
      />
    </div>

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
          :data-tx-id="getTransactionData(virtualRow.index)?.id"
          :class="rowClass(flatItems[virtualRow.index])"
        >
          <SwipeableItem
            v-if="getTransactionData(virtualRow.index) && swipeEnabled && !selectMode"
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
</template>
