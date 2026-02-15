import type { Goal } from '../aggregates/goal';

export const GOAL_REPOSITORY = Symbol('GOAL_REPOSITORY');

export interface IGoalRepository {
  findById(id: string): Promise<Goal | null>;
  findByUserId(userId: string): Promise<Goal[]>;
  save(goal: Goal): Promise<Goal>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
