import { http, HttpError } from '@/shared/api/http';
import type { Debt, DebtInsert } from '@/shared/api/database.types';
import type {
  DebtsPaginatedCursor,
  DebtsFilters,
  DebtStatus,
  DebtUpdate,
  PaginatedDebtsResult,
} from '../model/types';

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
  isPrivate: boolean;
  feeAmount: number;
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

interface OffsetBackendResponse {
  personName: string;
  currency: string;
  offsetAmount: number;
  debts: DebtResponse[];
}

export interface PayDebtPayload {
  amount: number;
  accountId: string;
  /** ISO-дата записей. По умолчанию — сейчас. */
  date?: string;
  forgiveRemainder?: boolean;
  /** Обязательна, если сумма больше остатка. */
  excessCategoryId?: string;
}

export interface PayDebtResult {
  debt: Debt;
  /** Запись самого платежа. Null, когда остаток только прощён. */
  payment_transaction_id: string | null;
  transaction_ids: string[];
}

interface PayDebtBackendResponse {
  debt: DebtResponse;
  paymentTransactionId: string | null;
  transactionIds: string[];
}

export interface OffsetResult {
  person_name: string;
  currency: string;
  offset_amount: number;
  debts: Debt[];
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
    // Долги, созданные до появления комиссии, приезжают без поля
    fee_amount: debt.feeAmount ?? 0,
  };
}

export const debtsApi = {
  /** Без статуса приезжают все долги, включая закрытые. */
  async getAll(status?: DebtStatus): Promise<Debt[]> {
    const data = await http.get<DebtResponse[]>('/debts', {
      params: status ? { status } : undefined,
    });
    return data.map(transformDebt);
  },

  async getPaginated(
    _userId: string,
    pageSize: number = 10,
    cursor?: DebtsPaginatedCursor,
    filters?: DebtsFilters,
  ): Promise<PaginatedDebtsResult> {
    const params: Record<string, string | number | boolean> = { pageSize };
    if (cursor) {
      params.cursorPersonName = cursor.personName;
      params.cursorDebtType = cursor.debtType;
      params.cursorCreatedAt = cursor.createdAt;
    }
    if (filters?.status) params.status = filters.status;
    if (filters?.currency) params.currency = filters.currency;
    if (filters?.personName) params.personName = filters.personName;

    const data = await http.get<PaginatedDebtsBackendResponse>('/debts/paginated', { params });

    return {
      groups: data.groups.map((g) => ({
        person_name: g.personName,
        debt_type: g.debtType,
        debts: g.debts.map(transformDebt),
      })),
      totalSummary: {
        totalGiven: data.totalSummary.totalGiven,
        totalTaken: data.totalSummary.totalTaken,
      },
      nextCursor: data.nextCursor,
      hasMore: data.hasMore,
      totalDebtsCount: data.totalDebtsCount,
    };
  },

  async getById(debtId: string): Promise<Debt | null> {
    try {
      const data = await http.get<DebtResponse>(`/debts/${debtId}`);
      return transformDebt(data);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return null;
      }
      throw error;
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
      nextPaymentDate: debt.next_payment_date ?? undefined,
      debtType: debt.debt_type ?? 'taken',
      personName: debt.person_name,
      accountId: debt.account_id,
      transactionId: debt.transaction_id ?? undefined,
      currency: debt.currency,
      sourceTransactionId: debt.source_transaction_id,
      description: debt.description,
      createdAt: debt.created_at,
      isPrivate: debt.is_private ?? false,
      feeAmount: debt.fee_amount ?? 0,
    });
    return transformDebt(data);
  },

  async update(id: string, updates: DebtUpdate): Promise<Debt> {
    // Build payload with only defined keys (keep null — needed to clear nullable fields via PATCH)
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.total_amount !== undefined) payload.totalAmount = updates.total_amount;
    if (updates.monthly_payment !== undefined) payload.monthlyPayment = updates.monthly_payment;
    if (updates.next_payment_date !== undefined)
      payload.nextPaymentDate = updates.next_payment_date;
    if (updates.debt_type !== undefined) payload.debtType = updates.debt_type;
    if (updates.person_name !== undefined) payload.personName = updates.person_name;
    if (updates.account_id !== undefined) payload.accountId = updates.account_id;
    if (updates.transaction_id !== undefined) payload.transactionId = updates.transaction_id;
    if (updates.source_transaction_id !== undefined)
      payload.sourceTransactionId = updates.source_transaction_id;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.is_private !== undefined) payload.isPrivate = updates.is_private;
    if (updates.created_at !== undefined) payload.createdAt = updates.created_at;

    const data = await http.patch<DebtResponse>(`/debts/${id}`, payload);
    return transformDebt(data);
  },

  /**
   * Взаимозачёт встречных долгов человека в одной валюте. Возвращает долги,
   * которых он коснулся, — их остатки уже пересчитаны сервером.
   */
  async offset(personName: string, currency: string): Promise<OffsetResult> {
    const data = await http.post<OffsetBackendResponse>('/debts/offset', {
      personName,
      currency,
    });
    return {
      person_name: data.personName,
      currency: data.currency,
      offset_amount: data.offsetAmount,
      debts: data.debts.map(transformDebt),
    };
  },

  /**
   * Платёж по долгу. Сервер сам считает остаток, решает, закрылся ли долг, и
   * заводит записи возврата, переплаты и прощения — всё одной транзакцией.
   */
  async pay(debtId: string, payload: PayDebtPayload): Promise<PayDebtResult> {
    const data = await http.post<PayDebtBackendResponse>(`/debts/${debtId}/payments`, {
      amount: payload.amount,
      accountId: payload.accountId,
      date: payload.date,
      forgiveRemainder: payload.forgiveRemainder ?? false,
      excessCategoryId: payload.excessCategoryId,
    });
    return {
      debt: transformDebt(data.debt),
      payment_transaction_id: data.paymentTransactionId,
      transaction_ids: data.transactionIds,
    };
  },

  /** Отменяет закрытие: снимает транзакции закрытия и возвращает долг в активные. */
  async reopen(id: string): Promise<Debt> {
    const data = await http.post<DebtResponse>(`/debts/${id}/reopen`);
    return transformDebt(data);
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/debts/${id}`);
  },
};
