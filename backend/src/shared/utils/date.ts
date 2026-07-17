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

/**
 * UTC offset in minutes of `timezone` at the given instant (e.g. +300 for UTC+5,
 * +330 for UTC+5:30). Delegates to the platform tz database via Intl, so it is
 * correct for DST and half-hour zones.
 */
function tzOffsetMinutes(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const f: Record<string, string> = {};
  for (const part of parts) f[part.type] = part.value;

  // Interpret the wall-clock fields as if they were UTC, then compare to the real
  // instant — the difference is the zone's offset from UTC at that instant.
  const asUTC = Date.UTC(+f.year, +f.month - 1, +f.day, +f.hour, +f.minute, +f.second);
  return Math.round((asUTC - instant.getTime()) / 60000);
}

/**
 * UTC Date for 00:00:00.000 wall-time of `dateStr` (`YYYY-MM-DD`) in `timezone`.
 *
 * E.g. startOfDayInTz('2026-07-12', 'Asia/Tashkent') === 2026-07-11T19:00:00.000Z.
 *
 * Single-pass offset sampling: exact for zones without DST (e.g. Tashkent) and
 * for standard offsets elsewhere. The only inaccuracy is within the ~1h window of
 * a DST transition that falls between the UTC guess and the true instant — not a
 * concern for the fixed-offset zones this app targets.
 */
export function startOfDayInTz(dateStr: string, timezone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const offset = tzOffsetMinutes(new Date(utcGuess), timezone);
  return new Date(utcGuess - offset * 60000);
}

/**
 * UTC Date for 23:59:59.999 wall-time of `dateStr` (`YYYY-MM-DD`) in `timezone`.
 * Same offset-sampling approach and caveat as {@link startOfDayInTz}.
 */
export function endOfDayInTz(dateStr: string, timezone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  const offset = tzOffsetMinutes(new Date(utcGuess), timezone);
  return new Date(utcGuess - offset * 60000);
}
