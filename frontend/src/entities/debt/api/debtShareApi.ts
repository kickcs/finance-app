import { http } from '@/shared/api/http';

/**
 * Снимок долгов одного человека. Бэкенд говорит camelCase — трансформация
 * границы живёт здесь, наружу типы уходят уже в этом виде.
 */
export interface SharedDebtEntry {
  title: string;
  direction: 'given' | 'taken';
  currency: string;
  totalAmount: number;
  remainingAmount: number;
  paidAmount: number;
  forgivenAmount: number;
  dueDate: string | null;
  createdAt: string;
}

export interface SharedDebtsPayload {
  personName: string;
  currency: string;
  net: number;
  totalGiven: number;
  totalTaken: number;
  ownerName: string | null;
  snapshotAt: number;
  debts: SharedDebtEntry[];
}

export const debtShareApi = {
  /** Публичная ссылка на сверку: бэкенд сохраняет снимок и возвращает URL вида /d/<token> */
  async share(payload: SharedDebtsPayload): Promise<{ token: string; url: string }> {
    return http.post<{ token: string; url: string }>('/debt-shares', payload);
  },
};
