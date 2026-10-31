import { computed, ref } from 'vue';
import type { Transaction } from '@/entities/transaction';

const canSelect = (tx: Transaction) => !tx.bulk_locked;

/** Ручной выбор строк: долгое нажатие или кнопка на плашке. Состояние живёт, пока открыт режим. */
export function useBulkSelection() {
  const isSelecting = ref(false);
  const selectedIds = ref<Set<string>>(new Set());

  // Половины пары оплаты отмечаются вместе: сервер всё равно берёт пару целиком.
  const idsOf = (tx: Transaction) =>
    tx.payment_sibling ? [tx.id, tx.payment_sibling.id] : [tx.id];

  function mutate(change: (next: Set<string>) => void) {
    const next = new Set(selectedIds.value);
    change(next);
    selectedIds.value = next;
  }

  function start(tx?: Transaction) {
    isSelecting.value = true;
    selectedIds.value = new Set();
    if (tx && canSelect(tx)) mutate((next) => idsOf(tx).forEach((id) => next.add(id)));
  }

  function toggle(tx: Transaction) {
    if (!canSelect(tx)) return;
    const ids = idsOf(tx);
    const on = ids.every((id) => selectedIds.value.has(id));
    mutate((next) => ids.forEach((id) => (on ? next.delete(id) : next.add(id))));
  }

  // Вторая половина пары едет с видимой, даже если её самой на экране нет.
  const reachableIds = (rows: Transaction[]) => new Set(rows.flatMap(idsOf));
  const selectableIds = (rows: Transaction[]) => reachableIds(rows.filter(canSelect));

  /** Сколько id можно отметить: счётчик «Выбрано N из M» не должен уходить за M. */
  const selectableCount = (rows: Transaction[]) => selectableIds(rows).size;

  const isAllSelected = (rows: Transaction[]) => {
    const ids = selectableIds(rows);
    return ids.size > 0 && [...ids].every((id) => selectedIds.value.has(id));
  };

  function selectAll(rows: Transaction[]) {
    const ids = isAllSelected(rows) ? new Set<string>() : selectableIds(rows);
    selectedIds.value = ids;
  }

  /** Строки ушли из списка (правка, фильтр): отметки на них не должны попасть в запрос. */
  function prune(rows: Transaction[]) {
    const present = reachableIds(rows);
    mutate((next) => next.forEach((id) => !present.has(id) && next.delete(id)));
  }

  function exit() {
    isSelecting.value = false;
    selectedIds.value = new Set();
  }

  return {
    isSelecting,
    selectedIds,
    selectedCount: computed(() => selectedIds.value.size),
    start,
    toggle,
    selectAll,
    isAllSelected,
    selectableCount,
    prune,
    exit,
  };
}
