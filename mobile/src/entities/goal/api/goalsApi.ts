import { http } from '@/shared/api/http';
import type { Goal, GoalInsert } from '@/shared/api/database.types';

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

function transformGoal(g: GoalResponse): Goal {
  return {
    id: g.id,
    user_id: g.userId,
    name: g.name,
    target_amount: g.targetAmount,
    current_amount: g.currentAmount,
    deadline: g.deadline,
    icon: g.icon,
    color: g.color,
    created_at: g.createdAt,
  };
}

export type GoalCreateInput = Omit<GoalInsert, 'user_id' | 'id' | 'created_at'>;

export const goalsApi = {
  async getAll(): Promise<Goal[]> {
    const data = await http<GoalResponse[]>('/api/goals');
    return data.map(transformGoal);
  },

  async getById(goalId: string): Promise<Goal> {
    const data = await http<GoalResponse>(`/api/goals/${goalId}`);
    return transformGoal(data);
  },

  async create(input: GoalCreateInput): Promise<Goal> {
    const data = await http<GoalResponse>('/api/goals', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        targetAmount: input.target_amount,
        currentAmount: input.current_amount ?? 0,
        deadline: input.deadline,
        icon: input.icon,
        color: input.color,
      }),
    });
    return transformGoal(data);
  },

  async update(id: string, updates: Partial<Goal>): Promise<Goal> {
    const data = await http<GoalResponse>(`/api/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: updates.name,
        targetAmount: updates.target_amount,
        currentAmount: updates.current_amount,
        deadline: updates.deadline,
        icon: updates.icon,
        color: updates.color,
      }),
    });
    return transformGoal(data);
  },

  async delete(id: string): Promise<void> {
    await http(`/api/goals/${id}`, { method: 'DELETE' });
  },
};
