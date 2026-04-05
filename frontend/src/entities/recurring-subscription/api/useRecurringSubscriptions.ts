import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { recurringSubscriptionQueryKeys } from './queryKeys';
import { recurringSubscriptionApi } from './recurringSubscriptionApi';
import type { RecurringSubscription, RecurringSubscriptionInsert } from '../model/types';

export function useRecurringSubscriptions(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? recurringSubscriptionQueryKeys.list(uid) : recurringSubscriptionQueryKeys.all;
  });

  // Main query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return recurringSubscriptionApi.getAll(uid);
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const subscriptions = computed(() => data.value ?? []);

  const activeSubscriptions = computed(() =>
    subscriptions.value.filter((s) => s.status === 'active'),
  );

  /**
   * Sum of all active subscriptions converted to a monthly-equivalent amount.
   * weekly × ~4.33, quarterly ÷ 3, yearly ÷ 12, custom: amount / (days / 30.44)
   * Only works meaningfully when all subscriptions share the same currency.
   */
  const totalMonthlyAmount = computed(() => {
    return activeSubscriptions.value.reduce((sum, sub) => {
      let monthly: number;
      switch (sub.frequency) {
        case 'weekly':
          monthly = sub.amount * (365 / 7 / 12);
          break;
        case 'monthly':
          monthly = sub.amount;
          break;
        case 'quarterly':
          monthly = sub.amount / 3;
          break;
        case 'yearly':
          monthly = sub.amount / 12;
          break;
        case 'custom':
          if (
            sub.frequency_days !== null &&
            sub.frequency_days !== undefined &&
            sub.frequency_days > 0
          ) {
            monthly = sub.amount / (sub.frequency_days / 30.44);
          } else {
            monthly = sub.amount;
          }
          break;
        default:
          monthly = sub.amount;
      }
      return sum + monthly;
    }, 0);
  });

  // --- Invalidation helper ---
  function invalidateAll() {
    const uid = toValue(userId);
    queryClient.invalidateQueries({ queryKey: queryKey.value });
    if (uid) {
      queryClient.invalidateQueries({
        queryKey: recurringSubscriptionQueryKeys.all,
      });
    }
  }

  // --- Create mutation ---
  const createMutation = useMutation({
    mutationFn: (data: RecurringSubscriptionInsert) => recurringSubscriptionApi.create(data),
    onMutate: async (newSub) => {
      const uid = toValue(userId);
      if (!uid) return;

      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<RecurringSubscription[]>(queryKey.value);

      const optimistic: RecurringSubscription = {
        id: `temp-${Date.now()}`,
        user_id: uid,
        description: newSub.description ?? null,
        account_id: newSub.account_id ?? null,
        frequency_days: newSub.frequency_days ?? null,
        notify_days_before: newSub.notify_days_before ?? 2,
        category_id: newSub.category_id ?? '',
        auto_charge: newSub.auto_charge ?? false,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...newSub,
      };

      queryClient.setQueryData<RecurringSubscription[]>(queryKey.value, (old) => [
        optimistic,
        ...(old ?? []),
      ]);

      return { previous };
    },
    onError: (_err, _newSub, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey.value, context.previous);
      }
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  // --- Update mutation ---
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<RecurringSubscription> }) =>
      recurringSubscriptionApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<RecurringSubscription[]>(queryKey.value);

      queryClient.setQueryData<RecurringSubscription[]>(
        queryKey.value,
        (old) => old?.map((s) => (s.id === id ? { ...s, ...updates } : s)) ?? [],
      );

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey.value, context.previous);
      }
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  // --- Delete mutation ---
  const deleteMutation = useMutation({
    mutationFn: (id: string) => recurringSubscriptionApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<RecurringSubscription[]>(queryKey.value);

      queryClient.setQueryData<RecurringSubscription[]>(
        queryKey.value,
        (old) => old?.filter((s) => s.id !== id) ?? [],
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey.value, context.previous);
      }
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  // --- Pause mutation ---
  const pauseMutation = useMutation({
    mutationFn: (id: string) => recurringSubscriptionApi.pause(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<RecurringSubscription[]>(queryKey.value);

      queryClient.setQueryData<RecurringSubscription[]>(
        queryKey.value,
        (old) => old?.map((s) => (s.id === id ? { ...s, status: 'paused' } : s)) ?? [],
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey.value, context.previous);
      }
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  // --- Resume mutation ---
  const resumeMutation = useMutation({
    mutationFn: (id: string) => recurringSubscriptionApi.resume(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<RecurringSubscription[]>(queryKey.value);

      queryClient.setQueryData<RecurringSubscription[]>(
        queryKey.value,
        (old) => old?.map((s) => (s.id === id ? { ...s, status: 'active' } : s)) ?? [],
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey.value, context.previous);
      }
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  // --- Public helpers ---
  async function createSubscription(data: RecurringSubscriptionInsert) {
    return createMutation.mutateAsync(data);
  }

  async function updateSubscription(id: string, updates: Partial<RecurringSubscription>) {
    return updateMutation.mutateAsync({ id, updates });
  }

  async function deleteSubscription(id: string) {
    return deleteMutation.mutateAsync(id);
  }

  async function pauseSubscription(id: string) {
    return pauseMutation.mutateAsync(id);
  }

  async function resumeSubscription(id: string) {
    return resumeMutation.mutateAsync(id);
  }

  return {
    subscriptions,
    activeSubscriptions,
    totalMonthlyAmount,
    isLoading,
    error,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    pauseSubscription,
    resumeSubscription,
    refetch,
  };
}
