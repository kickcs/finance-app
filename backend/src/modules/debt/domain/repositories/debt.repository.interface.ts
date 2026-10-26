import type { EntityManager } from 'typeorm';
import type { Debt } from '../aggregates/debt';

export const DEBT_REPOSITORY = Symbol('DEBT_REPOSITORY');

export interface DebtPaginationOptions {
  pageSize: number;
  cursorPersonName?: string;
  cursorDebtType?: string;
  cursorCreatedAt?: string;
  status?: string;
  currency?: string;
  personName?: string;
}

export interface DebtGroupResult {
  personName: string;
  debtType: string;
  lastDebtDate: Date;
  debts: Debt[];
}

export interface PaginatedDebtGroups {
  groups: DebtGroupResult[];
  totalSummary: {
    totalGiven: Record<string, number>;
    totalTaken: Record<string, number>;
  };
  nextCursor: { personName: string; debtType: string; createdAt: string } | null;
  hasMore: boolean;
  totalDebtsCount: number;
}

export interface IDebtRepository {
  /** Pass `manager` to read inside an open DB transaction. */
  findById(id: string, manager?: EntityManager): Promise<Debt | null>;
  findByUserId(userId: string, status?: 'active' | 'closed'): Promise<Debt[]>;
  findByTransactionId(transactionId: string): Promise<Debt | null>;
  /** Pass `manager` to read inside an open DB transaction. */
  findByCloseTransactionId(transactionId: string, manager?: EntityManager): Promise<Debt | null>;
  /** Открытые долги одного человека в одной валюте — материал для взаимозачёта. */
  findActiveByPerson(userId: string, personName: string, currency: string): Promise<Debt[]>;
  hasOpenDebtsForTransaction(transactionId: string, manager?: EntityManager): Promise<boolean>;
  /** Переносит долги разделения с одной транзакции на другую — когда часть оплаты удаляется. */
  relinkSourceTransaction(
    fromTransactionId: string,
    toTransactionId: string,
    manager?: EntityManager,
  ): Promise<void>;
  /** Pass `manager` to participate in an open DB transaction. */
  save(debt: Debt, manager?: EntityManager): Promise<Debt>;
  /** Pass `manager` to participate in an open DB transaction. */
  delete(id: string, manager?: EntityManager): Promise<void>;
  exists(id: string): Promise<boolean>;
  getPaginated(userId: string, options: DebtPaginationOptions): Promise<PaginatedDebtGroups>;
}
