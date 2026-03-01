import type { QuickAction } from '../aggregates/quick-action';

export const QUICK_ACTION_REPOSITORY = Symbol('QUICK_ACTION_REPOSITORY');

export interface IQuickActionRepository {
  findByUserId(userId: string): Promise<QuickAction[]>;
  findById(id: string): Promise<QuickAction | null>;
  save(quickAction: QuickAction): Promise<QuickAction>;
  saveMany(quickActions: QuickAction[]): Promise<QuickAction[]>;
  delete(id: string): Promise<void>;
  countByUserId(userId: string): Promise<number>;
}
