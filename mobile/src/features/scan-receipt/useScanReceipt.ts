import * as ImageManipulator from 'expo-image-manipulator';
import { useState } from 'react';

import { receiptApi, type ReceiptUploadInput } from './receiptApi';
import type { ScanReceiptResponse } from './types';

const MAX_DIMENSION = 1600;
const COMPRESS_QUALITY = 0.7;

export interface UseScanReceiptResult {
  scan: (file: ReceiptUploadInput) => Promise<ScanReceiptResponse>;
  isScanning: boolean;
  error: string | null;
  reset: () => void;
}

export function useScanReceipt(): UseScanReceiptResult {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function scan(file: ReceiptUploadInput) {
    setIsScanning(true);
    setError(null);
    try {
      // OCR latency budget is ~800ms per spec — shrink the image before
      // upload so we don't spend the budget on transferring a 10 MB photo.
      const manipulated = await ImageManipulator.manipulateAsync(
        file.uri,
        [{ resize: { width: MAX_DIMENSION } }],
        { compress: COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
      );
      const response = await receiptApi.scan({
        uri: manipulated.uri,
        mimeType: 'image/jpeg',
        fileName: 'receipt.jpg',
      });
      return response;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось распознать чек';
      setError(message);
      throw e;
    } finally {
      setIsScanning(false);
    }
  }

  return {
    scan,
    isScanning,
    error,
    reset: () => setError(null),
  };
}
