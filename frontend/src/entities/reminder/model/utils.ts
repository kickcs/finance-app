export const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function isReminderOverdue(reminder: { next_date: string; is_active: boolean }): boolean {
  return reminder.is_active && new Date(reminder.next_date).getTime() < Date.now();
}

export function isReminderUpcoming(
  reminder: { next_date: string; is_active: boolean },
  windowMs = THREE_DAYS_MS,
): boolean {
  const nextMs = new Date(reminder.next_date).getTime();
  const now = Date.now();
  return reminder.is_active && nextMs >= now && nextMs - now < windowMs;
}
