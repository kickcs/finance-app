import { http } from '@/shared/api/http';
import type { Goal, GoalInsert } from '@/shared/api/database.types';

// Response type from NestJS backend (camelCase)
interface GoalResponse {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  icon: string;
  color: string;
  createdAt: string;
}

function transformGoal(goal: GoalResponse): Goal {
  return {
    id: goal.id,
    user_id: goal.userId,
    name: goal.name,
    target_amount: goal.targetAmount,
    current_amount: goal.currentAmount,
    deadline: goal.deadline,
    icon: goal.icon,
    color: goal.color,
    created_at: goal.createdAt,
  };
}

export const goalsApi = {
  async getAll(_userId: string): Promise<Goal[]> {
    // Backend gets userId from JWT token
    const data = await http.get<GoalResponse[]>('/goals');
    return data.map(transformGoal);
  },

  async getById(goalId: string): Promise<Goal | null> {
    try {
      const data = await http.get<GoalResponse>(`/goals/${goalId}`);
      return transformGoal(data);
    } catch {
      return null;
    }
  },

  async create(goal: GoalInsert): Promise<Goal> {
    // Backend gets userId from JWT token
    const data = await http.post<GoalResponse>('/goals', {
      name: goal.name,
      targetAmount: goal.target_amount,
      currentAmount: goal.current_amount ?? 0,
      deadline: goal.deadline,
      icon: goal.icon,
      color: goal.color,
    });
    return transformGoal(data);
  },

  async update(id: string, updates: Partial<Goal>): Promise<Goal> {
    const data = await http.patch<GoalResponse>(`/goals/${id}`, {
      name: updates.name,
      targetAmount: updates.target_amount,
      currentAmount: updates.current_amount,
      deadline: updates.deadline,
      icon: updates.icon,
      color: updates.color,
    });
    return transformGoal(data);
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/goals/${id}`);
  },
};
