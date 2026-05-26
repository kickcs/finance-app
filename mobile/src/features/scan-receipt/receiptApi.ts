import { http } from '@/shared/api/http';

import type { ScanReceiptResponse } from './types';

interface RNUploadFile {
  uri: string;
  name: string;
  type: string;
}

export interface ReceiptUploadInput {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export const receiptApi = {
  scan: async (file: ReceiptUploadInput): Promise<ScanReceiptResponse> => {
    const form = new FormData();
    const upload: RNUploadFile = {
      uri: file.uri,
      name: file.fileName ?? 'receipt.jpg',
      type: file.mimeType ?? 'image/jpeg',
    };
    // RN FormData accepts the { uri, name, type } shape — `as never` because
    // the standard DOM FormData typing doesn't model it.
    form.append('image', upload as never);
    return http<ScanReceiptResponse>('/api/receipts/scan', {
      method: 'POST',
      body: form,
    });
  },
};
