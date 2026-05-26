import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Goal } from '@/shared/api/database.types';

import { goalsApi, type GoalCreateInput } from './goalsApi';
import { goalKeys } from './queryKeys';

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: goalKeys.all });
}

export function useGoals(userId: string | null) {
  return useQuery({
    queryKey: goalKeys.byUser(userId ?? '__disabled__'),
    queryFn: goalsApi.getAll,
    enabled: !!userId,
  });
}

export function useGoal(id: string | null) {
  return useQuery({
    queryKey: goalKeys.detail(id ?? '__disabled__'),
    queryFn: () => {
      if (!id) throw new Error('id is required');
      return goalsApi.getById(id);
    },
    enabled: !!id,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GoalCreateInput) => goalsApi.create(input),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Goal> }) =>
      goalsApi.update(id, updates),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.delete(id),
    onSuccess: () => invalidate(qc),
  });
}
