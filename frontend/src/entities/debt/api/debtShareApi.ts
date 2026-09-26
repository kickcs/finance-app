import { http } from '@/shared/api/http';
import { getDebtSplit, type Debt } from '../model/types';

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
  /** Карта владельца для перевода — голые цифры; в старых снимках её нет. */
  cardNumber?: string | null;
  debts: SharedDebtEntry[];
}

/**
 * Долг в виде записи снимка. Это граница: внутри приложения долг snake_case,
 * на проводе — camelCase, и превращение одного в другое живёт здесь, а не в
 * фиче, которая снимок собирает.
 */
export function toSharedDebtEntry(debt: Debt): SharedDebtEntry {
  const { paid, forgiven } = getDebtSplit(debt);
  return {
    title: debt.name,
    direction: debt.debt_type,
    currency: debt.currency,
    totalAmount: debt.total_amount,
    remainingAmount: debt.remaining_amount,
    paidAmount: paid,
    forgivenAmount: forgiven,
    dueDate: debt.next_payment_date,
    createdAt: debt.created_at,
  };
}

export const debtShareApi = {
  /** Публичная ссылка на сверку: бэкенд сохраняет снимок и возвращает URL вида /d/<token> */
  async share(payload: SharedDebtsPayload): Promise<{ token: string; url: string }> {
    return http.post<{ token: string; url: string }>('/debt-shares', payload);
  },
};
