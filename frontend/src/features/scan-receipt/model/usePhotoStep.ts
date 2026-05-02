import { ref, onUnmounted } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { receiptApi, type ScanReceiptResponse } from '../api/receiptApi';
import { useHaptics } from '@/shared/lib/haptics';

// Hoisted to module scope — avoids re-creation on every OCR call
const SERVICE_KEYWORDS =
  /обслуживание|service|чаевые|tip|ндс|vat|tax|скидка|discount|delivery|доставка/i;

export interface OcrResult {
  items: ScanReceiptResponse['items'];
  currency: string;
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
  const selectedFile = ref<File | null>(null);
  const previewUrl = ref<string | null>(null);
  const isOcrLoading = ref(false);
  const isOcrSuccess = ref(false);
  const ocrError = ref<string | null>(null);

  function selectFile(file: File) {
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
    ocrError.value = null;
    scanReceipt();
  }

  function resetPhoto() {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    selectedFile.value = null;
    previewUrl.value = null;
    isOcrLoading.value = false;
    isOcrSuccess.value = false;
    ocrError.value = null;
  }

  async function scanReceipt() {
    if (!selectedFile.value) return;
    isOcrLoading.value = true;
    ocrError.value = null;

    try {
      const result: ScanReceiptResponse = await receiptApi.scan(selectedFile.value);

      // Filter out service charge / tax / discount line items that GPT may still return
      const productItems = result.items.filter((item) => !SERVICE_KEYWORDS.test(item.name));

      onOcrSuccess({
        items: productItems,
        currency: result.currency,
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
      const fileInfo = selectedFile.value
        ? `[${selectedFile.value.type || 'unknown'}, ${Math.round(selectedFile.value.size / 1024)}KB]`
        : '';
      ocrError.value = `${msg} ${fileInfo}`.trim();
      trigger('error');
    } finally {
      isOcrLoading.value = false;
    }
  }

  onUnmounted(() => {
    cancelAdvance();
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
    }
  });

  return {
    previewUrl,
    isOcrLoading,
    isOcrSuccess,
    ocrError,
    selectFile,
    resetPhoto,
    scanReceipt,
  };
}
