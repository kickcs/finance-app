import { computed } from 'vue';
import { useLocalStorage, StorageSerializers } from '@vueuse/core';
import type { Participant, ReceiptCharge, ReceiptItem, ScanReceiptFormData } from './types';

export interface ReceiptDraft {
  /** Версия схемы — черновики других версий отбрасываются */
  v: 1;
  savedAt: number;
  step: number;
  items: ReceiptItem[];
  currency: string;
  storeName: string | null;
  ocrTotalAmount: number | null;
  charges: ReceiptCharge[];
  /** Итог на момент сохранения — для баннера «Продолжить?» без пересчёта */
  totalAmount: number;
  participants: Participant[];
  payerId: string | null;
  formData: ScanReceiptFormData;
  manualMode: boolean;
}

const STORAGE_KEY = 'scan-receipt:draft';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Черновик визарда в localStorage: переживает случайное закрытие страницы.
 * Фото не сохраняется — оно нужно только для OCR.
 */
export function useReceiptDraft() {
  const draft = useLocalStorage<ReceiptDraft | null>(STORAGE_KEY, null, {
    serializer: StorageSerializers.object,
  });

  /** Валидный черновик не старше 24 ч с хотя бы одной позицией */
  const freshDraft = computed<ReceiptDraft | null>(() => {
    const d = draft.value;
    if (!d || d.v !== 1) return null;
    if (!Array.isArray(d.items) || d.items.length === 0) return null;
    if (typeof d.savedAt !== 'number' || Date.now() - d.savedAt > MAX_AGE_MS) return null;
    return d;
  });

  function save(snapshot: Omit<ReceiptDraft, 'v' | 'savedAt'>) {
    draft.value = { ...snapshot, v: 1, savedAt: Date.now() };
  }

  function clear() {
    draft.value = null;
  }

  return { draft, freshDraft, save, clear };
}
