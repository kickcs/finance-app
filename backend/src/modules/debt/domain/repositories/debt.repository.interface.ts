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
  findById(id: string): Promise<Debt | null>;
  findByUserId(userId: string): Promise<Debt[]>;
  findByTransactionId(transactionId: string): Promise<Debt | null>;
  findByCloseTransactionId(transactionId: string): Promise<Debt | null>;
  hasOpenDebtsForTransaction(transactionId: string): Promise<boolean>;
  save(debt: Debt): Promise<Debt>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  getPaginated(userId: string, options: DebtPaginationOptions): Promise<PaginatedDebtGroups>;
}
