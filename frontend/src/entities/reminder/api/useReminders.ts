import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { reminderQueryKeys } from './queryKeys';
import { remindersApi } from './remindersApi';
import type { Reminder, ReminderInsert } from '@/shared/api/database.types';
import { isReminderUpcoming, isReminderOverdue, SEVEN_DAYS_MS } from '../model/utils';

export function useReminders(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? reminderQueryKeys.list(uid) : reminderQueryKeys.all;
  });

  // Main query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return remindersApi.getAll(uid);
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const reminders = computed(() => data.value ?? []);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (reminder: Omit<ReminderInsert, 'user_id'>) => {
      const uid = toValue(userId);
      if (!uid) throw new Error('User not authenticated');
      return remindersApi.create({ ...reminder, user_id: uid });
    },
    onMutate: async (newReminder) => {
      const uid = toValue(userId);
      if (!uid) return;

      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousReminders = queryClient.getQueryData<Reminder[]>(queryKey.value);

      const optimisticReminder: Reminder = {
        id: `temp-${Date.now()}`,
        user_id: uid,
        created_at: new Date().toISOString(),
        is_active: true,
        ...newReminder,
      } as Reminder;

      queryClient.setQueryData<Reminder[]>(queryKey.value, (old) =>
        [...(old ?? []), optimisticReminder].sort(
          (a, b) => new Date(a.next_date).getTime() - new Date(b.next_date).getTime(),
        ),
      );

      return { previousReminders };
    },
    onError: (_err, _newReminder, context) => {
      if (context?.previousReminders) {
        queryClient.setQueryData(queryKey.value, context.previousReminders);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Reminder> }) =>
      remindersApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousReminders = queryClient.getQueryData<Reminder[]>(queryKey.value);

      queryClient.setQueryData<Reminder[]>(
        queryKey.value,
        (old) => old?.map((r) => (r.id === id ? { ...r, ...updates } : r)) ?? [],
      );

      return { previousReminders };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousReminders) {
        queryClient.setQueryData(queryKey.value, context.previousReminders);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remindersApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousReminders = queryClient.getQueryData<Reminder[]>(queryKey.value);

      queryClient.setQueryData<Reminder[]>(
        queryKey.value,
        (old) => old?.filter((r) => r.id !== id) ?? [],
      );

      return { previousReminders };
    },
    onError: (_err, _id, context) => {
      if (context?.previousReminders) {
        queryClient.setQueryData(queryKey.value, context.previousReminders);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Computed values
  const activeReminders = computed(() => reminders.value.filter((r) => r.is_active));

  const upcomingReminders = computed(() =>
    activeReminders.value.filter((r) => isReminderUpcoming(r, SEVEN_DAYS_MS)),
  );

  const overdueReminders = computed(() =>
    activeReminders.value.filter((r) => isReminderOverdue(r)),
  );

  // Helper functions (same public API)
  async function createReminder(reminder: Omit<ReminderInsert, 'user_id'>) {
    return createMutation.mutateAsync(reminder);
  }

  async function updateReminder(id: string, updates: Partial<Reminder>) {
    return updateMutation.mutateAsync({ id, updates });
  }

  async function toggleReminder(id: string) {
    const reminder = reminders.value.find((r) => r.id === id);
    if (!reminder) throw new Error('Reminder not found');
    return updateReminder(id, { is_active: !reminder.is_active });
  }

  async function completeReminder(id: string) {
    const reminder = reminders.value.find((r) => r.id === id);
    if (!reminder) throw new Error('Reminder not found');

    const currentTime = new Date(reminder.next_date).getTime();
    let nextDate: Date;

    switch (reminder.frequency) {
      case 'weekly':
        nextDate = new Date(currentTime + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly': {
        const temp = new Date(currentTime);
        temp.setMonth(temp.getMonth() + 1);
        nextDate = temp;
        break;
      }
      case 'yearly': {
        const temp = new Date(currentTime);
        temp.setFullYear(temp.getFullYear() + 1);
        nextDate = temp;
        break;
      }
      case 'once':
        return updateReminder(id, { is_active: false });
      default:
        nextDate = new Date(currentTime);
    }

    return updateReminder(id, { next_date: nextDate.toISOString() });
  }

  async function deleteReminder(id: string) {
    return deleteMutation.mutateAsync(id);
  }

  return {
    reminders,
    isLoading,
    error,
    activeReminders,
    upcomingReminders,
    overdueReminders,
    createReminder,
    updateReminder,
    toggleReminder,
    completeReminder,
    deleteReminder,
    refetch,
  };
}
