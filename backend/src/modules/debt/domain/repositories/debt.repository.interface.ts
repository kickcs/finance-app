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
  /** Долги одним запросом, чужие тоже: владельца проверяет вызывающий. Несуществующие id не возвращаются. */
  findByIds(ids: readonly string[]): Promise<Debt[]>;
  /**
   * Блокирует долги пользователя до конца транзакции (`FOR UPDATE`, по id — один порядок для всех
   * расчётов) и возвращает их свежими. Чужие и несуществующие id не возвращаются.
   */
  findByIdsForUpdate(
    ids: readonly string[],
    userId: string,
    manager: EntityManager,
  ): Promise<Debt[]>;
  /** Открытые долги одного человека в одной валюте — материал для взаимозачёта. С `manager` читает в открытой транзакции. */
  findActiveByPerson(
    userId: string,
    personName: string,
    currency: string,
    manager?: EntityManager,
  ): Promise<Debt[]>;
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
