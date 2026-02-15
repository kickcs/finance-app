// Query key factory for goals entity
export const goalQueryKeys = {
  all: ['goals'] as const,
  list: (userId: string) => [...goalQueryKeys.all, 'list', userId] as const,
  detail: (goalId: string) => [...goalQueryKeys.all, 'detail', goalId] as const,
};

export type GoalQueryKeys = typeof goalQueryKeys;
