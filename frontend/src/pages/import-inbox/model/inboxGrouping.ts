import type { ImportedTransaction } from '@/entities/imported-transaction';
import { i18n } from '@/shared/i18n';
import { formatDateGroup } from '@/shared/lib/format/date';

/**
 * Банк присылает мерчанта с обрубленным городом после `>`
 * (`ZOOMRAD P2P UZ2HU>TO`, `YANDEX EATS>Toshkent`) — в интерфейсе город не
 * нужен, а необрезанный разделитель ломает читаемость строки.
 */
export function cleanMerchantName(merchant: string | null | undefined): string {
  if (!merchant) return '';
  return merchant.split('>')[0].trim().replace(/\s+/g, ' ');
}

/** Ярлык дня для группировки инбокса: «Сегодня» / «Вчера» / «25 сентября». */
export function inboxGroupLabel(date: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return i18n.global.t('shared.date.today');
  if (diffDays === 1) return i18n.global.t('shared.date.yesterday');
  return formatDateGroup(date);
}

export interface InboxDayGroup {
  label: string;
  items: ImportedTransaction[];
}

/**
 * Группирует уже отсортированный (см. useInboxSortOrder) список по
 * календарному дню без пересортировки — порядок групп и элементов внутри
 * них определяется исключительно порядком входного массива.
 */
export function groupInboxItemsByDay(items: ImportedTransaction[]): InboxDayGroup[] {
  const groups: InboxDayGroup[] = [];
  for (const item of items) {
    const date = new Date(item.occurred_at ?? item.created_at);
    const label = inboxGroupLabel(date);
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}
