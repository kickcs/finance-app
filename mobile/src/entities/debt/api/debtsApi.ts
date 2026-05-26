import { http } from '@/shared/api/http';
import type { Debt, DebtInsert } from '@/shared/api/database.types';

import type {
  DebtsFilters,
  DebtsPaginatedCursor,
  PaginatedDebtsResult,
} from '../model/types';

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
  isPrivate: boolean;
}

interface DebtGroupBackendResponse {
  personName: string;
  debtType: 'given' | 'taken';
  debts: DebtResponse[];
}

interface PaginatedDebtsBackendResponse {
  groups: DebtGroupBackendResponse[];
  totalSummary: {
    totalGiven: Record<string, number>;
    totalTaken: Record<string, number>;
  };
  nextCursor: { personName: string; debtType: string; createdAt: string } | null;
  hasMore: boolean;
  totalDebtsCount: number;
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
    is_private: debt.isPrivate,
  };
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export type DebtCreateInput = Omit<DebtInsert, 'user_id' | 'id' | 'created_at'> & {
  created_at?: string;
};

export const debtsApi = {
  async getAll(): Promise<Debt[]> {
    const data = await http<DebtResponse[]>('/api/debts');
    return data.map(transformDebt);
  },

  async getPaginated(
    pageSize = 10,
    cursor?: DebtsPaginatedCursor,
    filters?: DebtsFilters,
  ): Promise<PaginatedDebtsResult> {
    const qs = buildQuery({
      pageSize,
      cursorPersonName: cursor?.personName,
      cursorDebtType: cursor?.debtType,
      cursorCreatedAt: cursor?.createdAt,
      status: filters?.status,
      currency: filters?.currency,
      personName: filters?.personName,
    });
    const data = await http<PaginatedDebtsBackendResponse>(`/api/debts/paginated${qs}`);
    return {
      groups: data.groups.map((g) => ({
        person_name: g.personName,
        debt_type: g.debtType,
        debts: g.debts.map(transformDebt),
      })),
      totalSummary: data.totalSummary,
      nextCursor: data.nextCursor,
      hasMore: data.hasMore,
      totalDebtsCount: data.totalDebtsCount,
    };
  },

  async getById(debtId: string): Promise<Debt> {
    const data = await http<DebtResponse>(`/api/debts/${debtId}`);
    return transformDebt(data);
  },

  async create(input: DebtCreateInput): Promise<Debt> {
    const data = await http<DebtResponse>('/api/debts', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        totalAmount: input.total_amount,
        remainingAmount: input.remaining_amount,
        monthlyPayment: input.monthly_payment,
        nextPaymentDate: input.next_payment_date ?? undefined,
        debtType: input.debt_type ?? 'taken',
        personName: input.person_name,
        accountId: input.account_id,
        transactionId: input.transaction_id ?? undefined,
        currency: input.currency,
        sourceTransactionId: input.source_transaction_id,
        description: input.description,
        createdAt: input.created_at,
        isPrivate: input.is_private ?? false,
      }),
    });
    return transformDebt(data);
  },

  async update(id: string, updates: Partial<Debt>): Promise<Debt> {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.total_amount !== undefined) payload.totalAmount = updates.total_amount;
    if (updates.remaining_amount !== undefined) payload.remainingAmount = updates.remaining_amount;
    if (updates.monthly_payment !== undefined) payload.monthlyPayment = updates.monthly_payment;
    if (updates.next_payment_date !== undefined) payload.nextPaymentDate = updates.next_payment_date;
    if (updates.debt_type !== undefined) payload.debtType = updates.debt_type;
    if (updates.person_name !== undefined) payload.personName = updates.person_name;
    if (updates.account_id !== undefined) payload.accountId = updates.account_id;
    if (updates.transaction_id !== undefined) payload.transactionId = updates.transaction_id;
    if (updates.close_transaction_id !== undefined)
      payload.closeTransactionId = updates.close_transaction_id;
    if (updates.is_closed !== undefined) payload.isClosed = updates.is_closed;
    if (updates.currency !== undefined) payload.currency = updates.currency;
    if (updates.source_transaction_id !== undefined)
      payload.sourceTransactionId = updates.source_transaction_id;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.forgiven_amount !== undefined) payload.forgivenAmount = updates.forgiven_amount;
    if (updates.is_private !== undefined) payload.isPrivate = updates.is_private;

    const data = await http<DebtResponse>(`/api/debts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return transformDebt(data);
  },

  async delete(id: string): Promise<void> {
    await http(`/api/debts/${id}`, { method: 'DELETE' });
  },

  async close(id: string, accountId: string): Promise<Debt> {
    // Backend records a closing transaction tied to the chosen account, then
    // flips is_closed. Endpoint convention mirrors Vue's debtsApi.close.
    const data = await http<DebtResponse>(`/api/debts/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    });
    return transformDebt(data);
  },

  async partialPayment(id: string, amount: number, accountId: string): Promise<Debt> {
    const data = await http<DebtResponse>(`/api/debts/${id}/partial-payment`, {
      method: 'POST',
      body: JSON.stringify({ amount, accountId }),
    });
    return transformDebt(data);
  },
};
