import { ref, computed } from 'vue';
import { useHaptics } from '@/shared/lib/haptics';
import { calcLineTotal, calcLineTotalWithCharges, getTotalChargePercent } from './calcLineTotal';
import { uid } from './uid';
import type { ReceiptItem, ReceiptCharge } from './types';

export function useItemsStep() {
  const { trigger } = useHaptics();

  const items = ref<ReceiptItem[]>([]);
  const currency = ref('UZS');
  const storeName = ref<string | null>(null);
  const charges = ref<ReceiptCharge[]>([]);

  // Computed
  const subtotal = computed(() => items.value.reduce((sum, item) => sum + calcLineTotal(item), 0));

  const totalChargePercent = computed(() => getTotalChargePercent(charges.value));

  const chargesAmount = computed(() => {
    if (!totalChargePercent.value) return 0;
    return Math.round((subtotal.value * totalChargePercent.value) / 100);
  });

  const totalAmount = computed(() => subtotal.value + chargesAmount.value);

  // Per-item charge-inclusive price (proportionally distributed)
  function getItemWithChargesTotal(item: ReceiptItem): number {
    return calcLineTotalWithCharges(item, charges.value);
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

  function deleteItem(id: string) {
    items.value = items.value.filter((i) => i.id !== id);
    trigger('warning');
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

  // Charge management
  function addCharge(label: string, percent: number) {
    charges.value.push({ id: uid(), label, percent, enabled: true });
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
    if (charge) {
      charge.percent = percent;
    }
  }

  return {
    items,
    currency,
    storeName,
    charges,
    subtotal,
    chargesAmount,
    totalChargePercent,
    totalAmount,
    getItemWithChargesTotal,
    updateItem,
    deleteItem,
    addItem,
    splitItem,
    addCharge,
    removeCharge,
    toggleCharge,
    updateChargePercent,
  };
}
