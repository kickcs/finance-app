import { Debt } from '../aggregates/debt';

export const DEBT_REPOSITORY = Symbol('DEBT_REPOSITORY');

export interface IDebtRepository {
  findById(id: string): Promise<Debt | null>;
  findByUserId(userId: string): Promise<Debt[]>;
  findByTransactionId(transactionId: string): Promise<Debt | null>;
  save(debt: Debt): Promise<Debt>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
