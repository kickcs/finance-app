import { computed } from 'vue';
import { useAsyncOperation } from '@/shared/lib/hooks/useAsyncOperation';
import { useReminders } from '@/entities/reminder';
import type { Reminder } from '@/shared/api/database.types';

export function useEditReminder(userId: string) {
  const { updateReminder, deleteReminder } = useReminders(userId);

  const {
    isLoading: isUpdating,
    error: updateError,
    execute: update,
  } = useAsyncOperation(
    async (reminderId: string, updates: Partial<Reminder>) => {
      await updateReminder(reminderId, updates);
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
      return true;
    },
    { errorMessage: 'Не удалось удалить подписку' },
  );

  const error = computed(() => updateError.value || deleteError.value);

  return { isUpdating, isDeleting, error, update, remove };
}
