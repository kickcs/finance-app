import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { recurringSubscriptionQueryKeys } from './queryKeys';
import { recurringSubscriptionApi } from './recurringSubscriptionApi';
import { invalidateSubscriptionRelated } from '@/shared/api/invalidation';
import { useExchangeRates } from '@/shared/api/composables/useExchangeRates';
import type { RecurringSubscription, RecurringSubscriptionInsert } from '../model/types';

export function useRecurringSubscriptions(
  userId: MaybeRefOrGetter<string | null>,
  targetCurrency?: MaybeRefOrGetter<string | null>,
) {
  const queryClient = useQueryClient();

  // Resolve a non-null currency string for the exchange rates query; when no
  // target currency is provided we still need a string but we won't actually
  // call `convert` (see totalMonthlyAmount below).
  const exchangeBaseCurrency = computed(() => toValue(targetCurrency) ?? 'USD');
  const { convert } = useExchangeRates(exchangeBaseCurrency);

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? recurringSubscriptionQueryKeys.list(uid) : recurringSubscriptionQueryKeys.all;
  });

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

  // Monthly-equivalent sum across active subscriptions, converted into
  // `targetCurrency` when supplied. Without a target currency, sums raw
  // amounts (legacy behavior, only meaningful for single-currency users).
  const totalMonthlyAmount = computed(() => {
    const target = toValue(targetCurrency);
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
          if (sub.frequency_days && sub.frequency_days > 0) {
            monthly = sub.amount / (sub.frequency_days / 30.44);
          } else {
            monthly = sub.amount;
          }
          break;
        default:
          monthly = sub.amount;
      }
      const converted = target ? convert(monthly, sub.currency) : monthly;
      return sum + converted;
    }, 0);
  });

  function invalidateAll() {
    const uid = toValue(userId);
    if (uid) {
      invalidateSubscriptionRelated(queryClient, uid);
    } else {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: RecurringSubscriptionInsert) => recurringSubscriptionApi.create(data),
    onMutate: async (newSub) => {
      const uid = toValue(userId);
      if (!uid) return;

      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<RecurringSubscription[]>(queryKey.value);

      const now = new Date().toISOString();
      const optimistic: RecurringSubscription = {
        ...newSub,
        id: `temp-${Date.now()}`,
        user_id: uid,
        description: newSub.description ?? null,
        account_id: newSub.account_id ?? null,
        frequency_days: newSub.frequency_days ?? null,
        notify_days_before: newSub.notify_days_before ?? [2],
        category_id: newSub.category_id ?? '',
        auto_charge: newSub.auto_charge ?? false,
        status: 'active',
        created_at: now,
        updated_at: now,
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

  return {
    subscriptions,
    activeSubscriptions,
    totalMonthlyAmount,
    isLoading,
    error,
    createSubscription: (data: RecurringSubscriptionInsert) => createMutation.mutateAsync(data),
    updateSubscription: (id: string, updates: Partial<RecurringSubscription>) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteSubscription: (id: string) => deleteMutation.mutateAsync(id),
    pauseSubscription: (id: string) => pauseMutation.mutateAsync(id),
    resumeSubscription: (id: string) => resumeMutation.mutateAsync(id),
    refetch,
  };
}
