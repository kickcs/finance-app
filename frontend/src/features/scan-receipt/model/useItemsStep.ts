import { ref, computed } from 'vue';
import { useHaptics } from '@/shared/lib/haptics';
import { calcLineTotal, calcLineTotalWithCharges, getTotalChargesAmount } from './calcLineTotal';
import { uid } from './uid';
import type { ReceiptItem, ReceiptCharge } from './types';

export type NewChargeInput =
  | { label: string; type: 'percent'; percent: number }
  | { label: string; type: 'amount'; amount: number };

/** Максимум строк при «разложить по 1 шт» — защита от случайного qty=100. */
const MAX_EXPLODE_LINES = 10;

/**
 * Можно ли разложить позицию по 1 шт на строку: целое qty в диапазоне
 * [2, MAX_EXPLODE_LINES]. Единый источник правды — используется и моделью
 * (explodeItem), и UI (кнопка в SplitItemModal), чтобы правило не разъезжалось.
 */
export function canExplodeItem(item: Pick<ReceiptItem, 'qty'>): boolean {
  return Number.isInteger(item.qty) && item.qty >= 2 && item.qty <= MAX_EXPLODE_LINES;
}

export function useItemsStep() {
  const { trigger } = useHaptics();

  const items = ref<ReceiptItem[]>([]);
  const currency = ref('UZS');
  const storeName = ref<string | null>(null);
  const charges = ref<ReceiptCharge[]>([]);

  // Итог чека из OCR — источник правды для сверки «позиции vs чек»
  const ocrTotalAmount = ref<number | null>(null);
  const mismatchDismissed = ref(false);

  // Computed
  const subtotal = computed(() => items.value.reduce((sum, item) => sum + calcLineTotal(item), 0));

  const chargesAmount = computed(() => getTotalChargesAmount(subtotal.value, charges.value));

  const totalAmount = computed(() => subtotal.value + chargesAmount.value);

  // Расхождение суммы позиций+сборов с итогом чека (>1% — предупреждаем)
  const totalMismatch = computed<{ diff: number } | null>(() => {
    if (mismatchDismissed.value) return null;
    const ocr = ocrTotalAmount.value;
    if (!ocr || ocr <= 0 || items.value.length === 0) return null;
    const diff = ocr - totalAmount.value;
    if (Math.abs(diff) / ocr <= 0.01) return null;
    return { diff };
  });

  function setOcrTotalAmount(value: number | null) {
    ocrTotalAmount.value = value && value > 0 ? value : null;
    mismatchDismissed.value = false;
  }

  function dismissMismatch() {
    mismatchDismissed.value = true;
  }

  // Добавляет недостающую разницу строкой «Прочее». Процентные сборы считаются
  // от subtotal, поэтому цена строки корректируется на (1 + P), чтобы итог
  // сошёлся с чеком, а не перелетел его.
  function addDiffAsItem() {
    const mismatch = totalMismatch.value;
    if (!mismatch || mismatch.diff <= 0) return;
    const percentFactor =
      charges.value
        .filter((c) => c.enabled && c.type === 'percent')
        .reduce((sum, c) => sum + (c.type === 'percent' ? c.percent : 0), 0) / 100;
    const unitPrice = Math.round((mismatch.diff / (1 + percentFactor)) * 100) / 100;
    items.value.push({
      id: uid(),
      name: 'Прочее',
      qty: 1,
      unitPrice,
      ocrTotalPrice: null,
      assignedParticipantIds: [],
    });
    trigger('selection');
  }

  // Per-item charge-inclusive price (proportionally distributed) — used by submit/split
  function getItemWithChargesTotal(item: ReceiptItem): number {
    return calcLineTotalWithCharges(item, charges.value, subtotal.value);
  }

  // Item editing
  function updateItem(id: string, updates: Partial<ReceiptItem>) {
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx !== -1) {
      // Clear OCR total when user manually edits qty or price — recalculate from qty × unitPrice
      if ('qty' in updates || 'unitPrice' in updates) {
        updates.ocrTotalPrice = null;
      }
      items.value[idx] = { ...items.value[idx], ...updates };
    }
  }

  /** Возвращает снапшот для undo (тост «Вернуть» в useReceiptWizard). */
  function deleteItem(id: string): { item: ReceiptItem; index: number } | null {
    const index = items.value.findIndex((i) => i.id === id);
    if (index === -1) return null;
    const [item] = items.value.splice(index, 1);
    trigger('warning');
    return { item, index };
  }

  function restoreItem(item: ReceiptItem, index: number) {
    const at = Math.min(Math.max(index, 0), items.value.length);
    items.value.splice(at, 0, item);
    trigger('selection');
  }

  function addItem(): string {
    const id = uid();
    items.value.push({
      id,
      name: '',
      qty: 1,
      unitPrice: 0,
      ocrTotalPrice: null,
      assignedParticipantIds: [],
    });
    trigger('selection');
    return id;
  }

  function splitItem(id: string, firstQty: number) {
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const original = items.value[idx];
    const secondQty = original.qty - firstQty;
    if (firstQty <= 0 || secondQty <= 0) return;

    const ratio1 = firstQty / original.qty;

    const item1: ReceiptItem = {
      id: uid(),
      name: `${original.name} (1/2)`,
      qty: firstQty,
      unitPrice: original.unitPrice,
      ocrTotalPrice: original.ocrTotalPrice ? Math.round(original.ocrTotalPrice * ratio1) : null,
      assignedParticipantIds: [],
    };

    const item2: ReceiptItem = {
      id: uid(),
      name: `${original.name} (2/2)`,
      qty: secondQty,
      unitPrice: original.unitPrice,
      ocrTotalPrice: original.ocrTotalPrice
        ? original.ocrTotalPrice - Math.round(original.ocrTotalPrice * ratio1)
        : null,
      assignedParticipantIds: [],
    };

    items.value.splice(idx, 1, item1, item2);
    trigger('success');
  }

  // qty N → N строк по 1 шт: остаток ocrTotalPrice достаётся последней строке
  function explodeItem(id: string) {
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const original = items.value[idx];
    const qty = original.qty;
    if (!canExplodeItem(original)) return;

    const perLineOcr =
      original.ocrTotalPrice !== null ? Math.floor(original.ocrTotalPrice / qty) : null;
    const lines: ReceiptItem[] = Array.from({ length: qty }, (_, i) => ({
      id: uid(),
      name: `${original.name} (${i + 1}/${qty})`,
      qty: 1,
      unitPrice: original.unitPrice,
      ocrTotalPrice:
        original.ocrTotalPrice === null || perLineOcr === null
          ? null
          : i === qty - 1
            ? original.ocrTotalPrice - perLineOcr * (qty - 1)
            : perLineOcr,
      assignedParticipantIds: [],
    }));
    items.value.splice(idx, 1, ...lines);
    trigger('success');
  }

  function addCharge(input: NewChargeInput) {
    charges.value.push({ id: uid(), enabled: true, ...input });
    trigger('selection');
  }

  function removeCharge(id: string) {
    charges.value = charges.value.filter((c) => c.id !== id);
    trigger('warning');
  }

  function toggleCharge(id: string) {
    const charge = charges.value.find((c) => c.id === id);
    if (charge) {
      charge.enabled = !charge.enabled;
      trigger('selection');
    }
  }

  function updateChargePercent(id: string, percent: number) {
    const charge = charges.value.find((c) => c.id === id);
    if (charge && charge.type === 'percent') {
      charge.percent = percent;
    }
  }

  function updateChargeAmount(id: string, amount: number) {
    const charge = charges.value.find((c) => c.id === id);
    if (charge && charge.type === 'amount') {
      charge.amount = amount;
    }
  }

  return {
    items,
    currency,
    storeName,
    charges,
    subtotal,
    chargesAmount,
    totalAmount,
    ocrTotalAmount,
    totalMismatch,
    setOcrTotalAmount,
    dismissMismatch,
    addDiffAsItem,
    getItemWithChargesTotal,
    updateItem,
    deleteItem,
    restoreItem,
    addItem,
    splitItem,
    explodeItem,
    addCharge,
    removeCharge,
    toggleCharge,
    updateChargePercent,
    updateChargeAmount,
  };
}
