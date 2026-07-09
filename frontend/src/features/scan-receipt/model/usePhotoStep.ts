import { ref, onUnmounted, type Ref } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { receiptApi, type ScanReceiptResponse } from '../api/receiptApi';
import { useHaptics } from '@/shared/lib/haptics';

// Hoisted to module scope — avoids re-creation on every OCR call
const SERVICE_KEYWORDS =
  /обслуживание|service|чаевые|tip|ндс|vat|tax|скидка|discount|delivery|доставка/i;

/** Максимум кадров одного чека (длинный чек по частям) */
export const MAX_RECEIPT_PHOTOS = 3;

export interface OcrError {
  message: string;
  details: string;
}

export interface OcrResult {
  items: ScanReceiptResponse['items'];
  currency: string;
  totalAmount: number;
  storeName: string | null;
  serviceChargePercent: number | null;
  serviceChargeAmount: number | null;
  hashtags: string[];
  date: string | null;
}

export function usePhotoStep(onOcrSuccess: (result: OcrResult) => void, goNext: () => void) {
  const { trigger } = useHaptics();

  const { start: scheduleAdvance, stop: cancelAdvance } = useTimeoutFn(goNext, 600, {
    immediate: false,
  });
  // Cast: UnwrapRef ломает тип File при глубоком анврапе
  const selectedFiles = ref([]) as Ref<File[]>;
  const previewUrls = ref<string[]>([]);
  const isOcrLoading = ref(false);
  const isOcrSuccess = ref(false);
  const ocrError = ref<OcrError | null>(null);

  /** Добавляет кадр; false — достигнут лимит MAX_RECEIPT_PHOTOS */
  function addFile(file: File): boolean {
    if (selectedFiles.value.length >= MAX_RECEIPT_PHOTOS) return false;
    selectedFiles.value.push(file);
    previewUrls.value.push(URL.createObjectURL(file));
    ocrError.value = null;
    return true;
  }

  function removeFile(index: number) {
    const [url] = previewUrls.value.splice(index, 1);
    if (url) URL.revokeObjectURL(url);
    selectedFiles.value.splice(index, 1);
  }

  function resetPhoto() {
    previewUrls.value.forEach((url) => URL.revokeObjectURL(url));
    selectedFiles.value = [];
    previewUrls.value = [];
    isOcrLoading.value = false;
    isOcrSuccess.value = false;
    ocrError.value = null;
  }

  async function scanReceipt() {
    if (selectedFiles.value.length === 0) return;
    isOcrLoading.value = true;
    ocrError.value = null;

    try {
      const result: ScanReceiptResponse = await receiptApi.scan(selectedFiles.value);

      // Filter out service charge / tax / discount line items that GPT may still return
      const productItems = result.items.filter((item) => !SERVICE_KEYWORDS.test(item.name));

      onOcrSuccess({
        items: productItems,
        currency: result.currency,
        totalAmount: result.totalAmount,
        storeName: result.storeName,
        serviceChargePercent: result.serviceChargePercent,
        serviceChargeAmount: result.serviceChargeAmount,
        hashtags: result.hashtags,
        date: result.date,
      });

      isOcrSuccess.value = true;
      trigger('success');
      // Auto-advance after 600ms
      scheduleAdvance();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const fileInfo = selectedFiles.value
        .map((f) => `[${f.type || 'unknown'}, ${Math.round(f.size / 1024)}KB]`)
        .join(' ');
      ocrError.value = {
        message: 'Не получилось прочитать чек',
        details: `${msg} ${fileInfo}`.trim(),
      };
      trigger('error');
    } finally {
      isOcrLoading.value = false;
    }
  }

  onUnmounted(() => {
    cancelAdvance();
    previewUrls.value.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.value = [];
  });

  return {
    selectedFiles,
    previewUrls,
    isOcrLoading,
    isOcrSuccess,
    ocrError,
    addFile,
    removeFile,
    resetPhoto,
    scanReceipt,
  };
}
