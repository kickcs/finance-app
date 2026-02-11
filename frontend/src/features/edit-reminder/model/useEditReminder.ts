import { ref } from 'vue'
import { useReminders, reminderQueryKeys } from '@/entities/reminder'
import type { Reminder } from '@/shared/api/database.types'
import { queryClient } from '@/shared/api/queryClient'

export function useEditReminder(userId: string) {
  const { updateReminder, deleteReminder } = useReminders(userId)

  const isUpdating = ref(false)
  const isDeleting = ref(false)
  const error = ref<string | null>(null)

  async function update(reminderId: string, updates: Partial<Reminder>) {
    isUpdating.value = true
    error.value = null

    try {
      await updateReminder(reminderId, updates)
      return true
    } catch (e) {
      error.value = 'Не удалось обновить подписку'
      console.error('Failed to update reminder:', e)
      return false
    } finally {
      isUpdating.value = false
    }
  }

  async function remove(reminderId: string) {
    isDeleting.value = true
    error.value = null

    try {
      await deleteReminder(reminderId)
      // Invalidate cache
      await queryClient.invalidateQueries({ queryKey: reminderQueryKeys.list(userId) })
      return true
    } catch (e) {
      error.value = 'Не удалось удалить подписку'
      console.error('Failed to delete reminder:', e)
      return false
    } finally {
      isDeleting.value = false
    }
  }

  return {
    isUpdating,
    isDeleting,
    error,
    update,
    remove,
  }
}
