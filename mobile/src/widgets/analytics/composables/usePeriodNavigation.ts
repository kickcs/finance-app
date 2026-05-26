import { useState } from 'react';
import { useFinancialPeriod } from '@/shared/lib/composables/useFinancialPeriod';

export type Scale = 'day' | 'week' | 'month' | 'year';

export type Period = { startISO: string; endISO: string };

export function usePeriodNavigation(initialScale: Scale = 'month') {
  const [scale, setScale] = useState<Scale>(initialScale);
  const [anchor, setAnchor] = useState<Date>(new Date());
  const financial = useFinancialPeriod(anchor);

  const prev = () => setAnchor((d) => shift(d, scale, -1));
  const next = () => setAnchor((d) => shift(d, scale, +1));
  const range = computeRange(anchor, scale, financial);

  return { scale, setScale, anchor, prev, next, range };
}

function shift(d: Date, scale: Scale, sign: number): Date {
  const next = new Date(d);
  if (scale === 'day') next.setDate(next.getDate() + sign);
  if (scale === 'week') next.setDate(next.getDate() + sign * 7);
  if (scale === 'month') next.setMonth(next.getMonth() + sign);
  if (scale === 'year') next.setFullYear(next.getFullYear() + sign);
  return next;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function computeRange(
  anchor: Date,
  scale: Scale,
  financial: { startISO: string; endISO: string } | null,
): Period {
  if (scale === 'month' && financial) {
    return { startISO: financial.startISO, endISO: financial.endISO };
  }
  if (scale === 'day') {
    const iso = toISO(anchor);
    return { startISO: iso, endISO: iso };
  }
  if (scale === 'week') {
    const day = anchor.getDay(); // 0=Sun
    // Use ISO week: monday start
    const mondayOffset = (day + 6) % 7;
    const start = new Date(anchor);
    start.setDate(start.getDate() - mondayOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { startISO: toISO(start), endISO: toISO(end) };
  }
  if (scale === 'year') {
    const y = anchor.getFullYear();
    return { startISO: `${y}-01-01`, endISO: `${y}-12-31` };
  }
  // Fallback: calendar month if financial period is null but scale is month
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { startISO: toISO(start), endISO: toISO(end) };
}
