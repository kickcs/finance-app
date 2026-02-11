import { Category } from '../aggregates/category';

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

/**
 * Category Repository Interface
 */
export interface ICategoryRepository {
  findById(id: string): Promise<Category | null>;
  findByUserId(userId: string): Promise<Category[]>;
  findByUserIdAndType(userId: string, type: string): Promise<Category[]>;
  save(category: Category): Promise<Category>;
  saveMany(categories: Category[]): Promise<Category[]>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  updateSortOrder(categoryIds: string[]): Promise<void>;
}
