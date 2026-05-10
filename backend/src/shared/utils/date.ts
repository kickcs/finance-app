export function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function subtractDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return formatDateUTC(date);
}

/**
 * Returns the calendar day (`YYYY-MM-DD`) of `date` as observed in the given
 * IANA timezone. Robust to DST and half-hour zones because it delegates to the
 * platform's tz database via `Intl.DateTimeFormat` rather than doing manual
 * offset math.
 */
export function formatDateInTz(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  let y = '';
  let m = '';
  let d = '';
  for (const part of parts) {
    if (part.type === 'year') y = part.value;
    else if (part.type === 'month') m = part.value;
    else if (part.type === 'day') d = part.value;
  }
  return `${y}-${m}-${d}`;
}

/**
 * Convenience: today's calendar day in the given IANA timezone.
 */
export function todayInTz(timezone: string): string {
  return formatDateInTz(new Date(), timezone);
}
