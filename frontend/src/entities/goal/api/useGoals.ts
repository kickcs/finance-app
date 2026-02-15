import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { goalQueryKeys } from './queryKeys';
import { goalsApi } from './goalsApi';
import type { Goal, GoalInsert } from '@/shared/api/database.types';

export function useGoals(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? goalQueryKeys.list(uid) : goalQueryKeys.all;
  });

  // Main query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return goalsApi.getAll(uid);
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const goals = computed(() => data.value ?? []);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (goal: Omit<GoalInsert, 'user_id'>) => {
      const uid = toValue(userId);
      if (!uid) throw new Error('User not authenticated');
      return goalsApi.create({ ...goal, user_id: uid });
    },
    onMutate: async (newGoal) => {
      const uid = toValue(userId);
      if (!uid) return;

      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousGoals = queryClient.getQueryData<Goal[]>(queryKey.value);

      const optimisticGoal: Goal = {
        id: `temp-${Date.now()}`,
        user_id: uid,
        created_at: new Date().toISOString(),
        current_amount: 0,
        deadline: null,
        ...newGoal,
      } as Goal;

      queryClient.setQueryData<Goal[]>(queryKey.value, (old) => [
        optimisticGoal,
        ...(old ?? []),
      ]);

      return { previousGoals };
    },
    onError: (_err, _newGoal, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(queryKey.value, context.previousGoals);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Goal> }) =>
      goalsApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousGoals = queryClient.getQueryData<Goal[]>(queryKey.value);

      queryClient.setQueryData<Goal[]>(
        queryKey.value,
        (old) =>
          old?.map((g) => (g.id === id ? { ...g, ...updates } : g)) ?? [],
      );

      return { previousGoals };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(queryKey.value, context.previousGoals);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalsApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousGoals = queryClient.getQueryData<Goal[]>(queryKey.value);

      queryClient.setQueryData<Goal[]>(
        queryKey.value,
        (old) => old?.filter((g) => g.id !== id) ?? [],
      );

      return { previousGoals };
    },
    onError: (_err, _id, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(queryKey.value, context.previousGoals);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Computed values
  const totalSaved = computed(() =>
    goals.value.reduce((sum, g) => sum + g.current_amount, 0),
  );

  const totalTarget = computed(() =>
    goals.value.reduce((sum, g) => sum + g.target_amount, 0),
  );

  const overallProgress = computed(() => {
    if (totalTarget.value === 0) return 0;
    return (totalSaved.value / totalTarget.value) * 100;
  });

  // Helper functions (same public API)
  async function createGoal(goal: Omit<GoalInsert, 'user_id'>) {
    return createMutation.mutateAsync(goal);
  }

  async function updateGoal(id: string, updates: Partial<Goal>) {
    return updateMutation.mutateAsync({ id, updates });
  }

  async function addToGoal(id: string, amount: number) {
    const goal = goals.value.find((g) => g.id === id);
    if (!goal) throw new Error('Goal not found');

    const newAmount = Math.min(
      goal.current_amount + amount,
      goal.target_amount,
    );
    return updateGoal(id, { current_amount: newAmount });
  }

  async function deleteGoal(id: string) {
    return deleteMutation.mutateAsync(id);
  }

  return {
    goals,
    isLoading,
    error,
    totalSaved,
    totalTarget,
    overallProgress,
    createGoal,
    updateGoal,
    addToGoal,
    deleteGoal,
    refetch,
  };
}
