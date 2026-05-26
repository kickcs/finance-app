import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invalidateSubscriptionRelated } from '@/shared/api/invalidation';

import type {
  RecurringSubscription,
  RecurringSubscriptionInsert,
} from '../model/types';
import { recurringSubscriptionApi } from './recurringSubscriptionApi';
import { recurringSubscriptionKeys } from './queryKeys';

export function useRecurringSubscriptions(userId: string | null) {
  return useQuery({
    queryKey: recurringSubscriptionKeys.list(userId ?? '__disabled__'),
    queryFn: recurringSubscriptionApi.getAll,
    enabled: !!userId,
  });
}

export function useRecurringSubscription(id: string | null) {
  return useQuery({
    queryKey: recurringSubscriptionKeys.detail(id ?? '__disabled__'),
    queryFn: () => {
      if (!id) throw new Error('id is required');
      return recurringSubscriptionApi.getById(id);
    },
    enabled: !!id,
  });
}

export function useUpcomingSubscriptions(userId: string | null, days = 7) {
  return useQuery({
    queryKey: recurringSubscriptionKeys.upcoming(userId ?? '__disabled__', days),
    queryFn: () => recurringSubscriptionApi.getUpcoming(days),
    enabled: !!userId,
  });
}

export function useCreateRecurringSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecurringSubscriptionInsert) => recurringSubscriptionApi.create(input),
    onSuccess: () => invalidateSubscriptionRelated(qc),
  });
}

export function useUpdateRecurringSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<RecurringSubscription>;
    }) => recurringSubscriptionApi.update(id, updates),
    onSuccess: () => invalidateSubscriptionRelated(qc),
  });
}

export function useDeleteRecurringSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringSubscriptionApi.delete(id),
    onSuccess: () => invalidateSubscriptionRelated(qc),
  });
}
