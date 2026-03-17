import { http } from '@/shared/api/http';
import type { Debt, DebtInsert } from '@/shared/api/database.types';

// Response type from NestJS backend (camelCase)
interface DebtResponse {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  monthlyPayment: number | null;
  nextPaymentDate: string | null;
  createdAt: string;
  debtType: 'given' | 'taken';
  personName: string | null;
  accountId: string | null;
  transactionId: string | null;
  closeTransactionId: string | null;
  isClosed: boolean;
  currency: string;
  sourceTransactionId: string | null;
  description: string | null;
  closedAt: string | null;
  forgivenAmount: number;
}

function transformDebt(debt: DebtResponse): Debt {
  return {
    id: debt.id,
    user_id: debt.userId,
    name: debt.name,
    total_amount: debt.totalAmount,
    remaining_amount: debt.remainingAmount,
    monthly_payment: debt.monthlyPayment,
    next_payment_date: debt.nextPaymentDate,
    created_at: debt.createdAt,
    debt_type: debt.debtType,
    person_name: debt.personName,
    account_id: debt.accountId,
    transaction_id: debt.transactionId,
    close_transaction_id: debt.closeTransactionId,
    is_closed: debt.isClosed,
    currency: debt.currency,
    source_transaction_id: debt.sourceTransactionId,
    description: debt.description,
    closed_at: debt.closedAt,
    forgiven_amount: debt.forgivenAmount,
  };
}

export const debtsApi = {
  async getAll(_userId: string): Promise<Debt[]> {
    // Backend gets userId from JWT token
    const data = await http.get<DebtResponse[]>('/debts');
    return data.map(transformDebt);
  },

  async getById(debtId: string): Promise<Debt | null> {
    try {
      const data = await http.get<DebtResponse>(`/debts/${debtId}`);
      return transformDebt(data);
    } catch {
      return null;
    }
  },

  async create(debt: DebtInsert): Promise<Debt> {
    // Backend gets userId from JWT token
    // Note: closeTransactionId is not in CreateDebtDto, only in UpdateDebtDto
    const data = await http.post<DebtResponse>('/debts', {
      name: debt.name,
      totalAmount: debt.total_amount,
      remainingAmount: debt.remaining_amount,
      monthlyPayment: debt.monthly_payment,
      nextPaymentDate: debt.next_payment_date,
      debtType: debt.debt_type ?? 'taken',
      personName: debt.person_name,
      accountId: debt.account_id,
      transactionId: debt.transaction_id ?? undefined,
      currency: debt.currency,
      sourceTransactionId: debt.source_transaction_id,
      description: debt.description,
      createdAt: debt.created_at,
    });
    return transformDebt(data);
  },

  async update(id: string, updates: Partial<Debt>): Promise<Debt> {
    const data = await http.patch<DebtResponse>(`/debts/${id}`, {
      name: updates.name,
      totalAmount: updates.total_amount,
      remainingAmount: updates.remaining_amount,
      monthlyPayment: updates.monthly_payment,
      nextPaymentDate: updates.next_payment_date,
      debtType: updates.debt_type,
      personName: updates.person_name,
      accountId: updates.account_id,
      transactionId: updates.transaction_id,
      closeTransactionId: updates.close_transaction_id,
      isClosed: updates.is_closed,
      currency: updates.currency,
      sourceTransactionId: updates.source_transaction_id,
      description: updates.description,
      forgivenAmount: updates.forgiven_amount,
    });
    return transformDebt(data);
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/debts/${id}`);
  },
};
