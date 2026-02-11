// Query key factory for reminders entity
export const reminderQueryKeys = {
  all: ['reminders'] as const,
  list: (userId: string) => [...reminderQueryKeys.all, 'list', userId] as const,
  detail: (reminderId: string) => [...reminderQueryKeys.all, 'detail', reminderId] as const,
}

export type ReminderQueryKeys = typeof reminderQueryKeys
