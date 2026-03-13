import type { Budget } from '../aggregates/budget';

export const BUDGET_REPOSITORY = Symbol('BUDGET_REPOSITORY');

export interface IBudgetRepository {
  findDefault(userId: string): Promise<Budget | null>;
  findOverride(userId: string, year: number, month: number): Promise<Budget | null>;
  findByUserId(userId: string): Promise<Budget[]>;
  save(budget: Budget): Promise<Budget>;
  delete(id: string): Promise<void>;
}
