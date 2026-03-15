import { computed, type MaybeRefOrGetter } from 'vue';
import { useAsyncOperation } from '@/shared/lib/hooks/useAsyncOperation';
import { useReminders } from '@/entities/reminder';
import { useToast } from '@/shared/ui';
import type { Reminder } from '@/shared/api/database.types';

export function useEditReminder(userId: MaybeRefOrGetter<string | null>) {
  const { toast } = useToast();
  const { updateReminder, deleteReminder } = useReminders(userId);

  const {
    isLoading: isUpdating,
    error: updateError,
    execute: update,
  } = useAsyncOperation(
    async (reminderId: string, updates: Partial<Reminder>) => {
      await updateReminder(reminderId, updates);
      toast({ title: 'Подписка обновлена', variant: 'success' });
      return true;
    },
    { errorMessage: 'Не удалось обновить подписку' },
  );

  const {
    isLoading: isDeleting,
    error: deleteError,
    execute: remove,
  } = useAsyncOperation(
    async (reminderId: string) => {
      // useReminders.deleteReminder already handles cache invalidation via onSettled
      await deleteReminder(reminderId);
      toast({ title: 'Подписка удалена', variant: 'success' });
      return true;
    },
    { errorMessage: 'Не удалось удалить подписку' },
  );

  const error = computed(() => updateError.value || deleteError.value);

  return { isUpdating, isDeleting, error, update, remove };
}
