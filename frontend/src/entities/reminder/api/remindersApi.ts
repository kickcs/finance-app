import { http } from '@/shared/api/http'
import type { Reminder, ReminderInsert } from '@/shared/api/database.types'

// Response type from NestJS backend (camelCase)
interface ReminderResponse {
  id: string
  userId: string
  name: string
  amount: number
  frequency: 'weekly' | 'monthly' | 'yearly' | 'once'
  nextDate: string
  icon: string
  color: string
  isActive: boolean
  createdAt: string
}

function transformReminder(reminder: ReminderResponse): Reminder {
  return {
    id: reminder.id,
    user_id: reminder.userId,
    name: reminder.name,
    amount: reminder.amount,
    frequency: reminder.frequency,
    next_date: reminder.nextDate,
    icon: reminder.icon,
    color: reminder.color,
    is_active: reminder.isActive,
    created_at: reminder.createdAt,
  }
}

export const remindersApi = {
  async getAll(_userId: string): Promise<Reminder[]> {
    // Backend gets userId from JWT token
    const data = await http.get<ReminderResponse[]>('/reminders')
    return data.map(transformReminder)
  },

  async getById(reminderId: string): Promise<Reminder | null> {
    try {
      const data = await http.get<ReminderResponse>(`/reminders/${reminderId}`)
      return transformReminder(data)
    } catch {
      return null
    }
  },

  async create(reminder: ReminderInsert): Promise<Reminder> {
    // Backend gets userId from JWT token
    // Note: isActive is not in CreateReminderDto, only in UpdateReminderDto
    const data = await http.post<ReminderResponse>('/reminders', {
      name: reminder.name,
      amount: reminder.amount,
      frequency: reminder.frequency,
      nextDate: reminder.next_date,
      icon: reminder.icon,
      color: reminder.color,
    })
    return transformReminder(data)
  },

  async update(id: string, updates: Partial<Reminder>): Promise<Reminder> {
    const data = await http.patch<ReminderResponse>(`/reminders/${id}`, {
      name: updates.name,
      amount: updates.amount,
      frequency: updates.frequency,
      nextDate: updates.next_date,
      icon: updates.icon,
      color: updates.color,
      isActive: updates.is_active,
    })
    return transformReminder(data)
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/reminders/${id}`)
  },
}
