import { http } from '@/shared/api/http';
import type { UserCategory, UserCategoryInsert } from '@/shared/api/database.types';

// Response type from NestJS backend (camelCase)
interface CategoryResponse {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  sortOrder: number;
  createdAt: string;
}

function transformCategory(cat: CategoryResponse): UserCategory {
  return {
    id: cat.id,
    user_id: cat.userId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    type: cat.type,
    sort_order: cat.sortOrder,
    created_at: cat.createdAt,
  };
}

export const categoriesApi = {
  async getAll(_userId: string): Promise<UserCategory[]> {
    // Backend gets userId from JWT token
    const data = await http.get<CategoryResponse[]>('/categories');
    return data.map(transformCategory);
  },

  async initializeDefaults(_userId: string): Promise<UserCategory[]> {
    // Single request to backend - it handles checking existing categories
    // and creating defaults if needed
    const data = await http.post<CategoryResponse[]>('/categories/initialize-defaults');
    return data.map(transformCategory);
  },

  async getByType(_userId: string, type: 'expense' | 'income'): Promise<UserCategory[]> {
    // Backend gets userId from JWT token
    const data = await http.get<CategoryResponse[]>('/categories', {
      params: { type },
    });
    return data.map(transformCategory);
  },

  async create(category: UserCategoryInsert): Promise<UserCategory> {
    // Backend gets userId from JWT token
    const data = await http.post<CategoryResponse>('/categories', {
      name: category.name,
      icon: category.icon,
      color: category.color,
      type: category.type,
      sortOrder: category.sort_order ?? 0,
    });
    return transformCategory(data);
  },

  async update(
    id: string,
    updates: Partial<Omit<UserCategory, 'id' | 'user_id' | 'created_at'>>,
  ): Promise<UserCategory> {
    const data = await http.patch<CategoryResponse>(`/categories/${id}`, {
      name: updates.name,
      icon: updates.icon,
      color: updates.color,
      type: updates.type,
      sortOrder: updates.sort_order,
    });
    return transformCategory(data);
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/categories/${id}`);
  },

  async reorder(categoryIds: string[]): Promise<void> {
    await http.post('/categories/reorder', { categoryIds });
  },
};
