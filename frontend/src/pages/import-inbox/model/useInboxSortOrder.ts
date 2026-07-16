import { useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import type { ImportedTransaction } from '@/entities/imported-transaction';

export type InboxSortOrder = 'newest' | 'oldest';

// Module-level singleton (mirrors useTheme): the inbox list and the confirm
// page must agree on the review order, so both read the same persisted ref.
const sortOrder = useLocalStorage<InboxSortOrder>(STORAGE_KEYS.IMPORT_INBOX_SORT_ORDER, 'newest');

/** occurred_at may be null (unparsed date) — fall back to created_at. */
function sortTimestamp(item: ImportedTransaction): number {
  return new Date(item.occurred_at ?? item.created_at).getTime();
}

export function useInboxSortOrder() {
  function toggle() {
    sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest';
  }

  function sortItems(items: ImportedTransaction[]): ImportedTransaction[] {
    const direction = sortOrder.value === 'newest' ? -1 : 1;
    return [...items].sort((a, b) => direction * (sortTimestamp(a) - sortTimestamp(b)));
  }

  return { sortOrder, toggle, sortItems };
}
