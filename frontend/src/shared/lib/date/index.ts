/**
 * Date utility functions
 */
import { CalendarDate, type DateValue } from '@internationalized/date';

/**
 * Check if a date string represents today
 */
export function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Check if a date string is in the past (before today)
 */
export function isPastDate(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Check if a date string is in the future
 */
export function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date > today;
}

/**
 * Format a Date to YYYY-MM-DD in local timezone.
 * Unlike toISOString().split('T')[0], this avoids UTC offset issues
 * (e.g. midnight UTC+5 becoming the previous day in UTC).
 */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get today's date as ISO string (YYYY-MM-DD) in local timezone
 */
export function getTodayISO(): string {
  return toLocalISODate(new Date());
}

/** Convert ISO date string (YYYY-MM-DD) to CalendarDate. Returns undefined for null/empty. */
export function isoToCalendarDate(dateStr: string | null | undefined): DateValue | undefined {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new CalendarDate(year, month, day);
}

/** Convert a DateValue (from @internationalized/date) to ISO date string (YYYY-MM-DD). Returns null for undefined. */
export function dateValueToISO(date: DateValue | undefined): string | null {
  if (!date) return null;
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}
