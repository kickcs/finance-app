import { API_URL } from '@/shared/api/http';

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

export interface SharedDebts {
  personName: string;
  currency: string;
  net: number;
  totalGiven: number;
  totalTaken: number;
  ownerName: string | null;
  snapshotAt: number;
  debts: SharedDebtEntry[];
}

export class SharedDebtsNotFoundError extends Error {
  constructor() {
    super('Shared debts not found');
  }
}

export const sharedDebtsApi = {
  /** Публичный эндпоинт — без авторизации */
  async get(token: string): Promise<SharedDebts> {
    const response = await fetch(`${API_URL}/debt-shares/${encodeURIComponent(token)}`);
    if (response.status === 404) throw new SharedDebtsNotFoundError();
    if (!response.ok) throw new Error(`Failed to load shared debts: ${response.status}`);
    return response.json();
  },
};
