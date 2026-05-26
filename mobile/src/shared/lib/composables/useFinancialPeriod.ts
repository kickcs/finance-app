import { useAuthStore } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';

export type FinancialPeriod = { startISO: string; endISO: string; startDay: number };

export function useFinancialPeriod(date: Date = new Date()): FinancialPeriod | null {
  const user = useAuthStore((s) => s.user);
  const { data: profile } = useProfile(user?.id ?? null);
  if (!profile) return null;
  const startDay = profile.financial_month_start_day ?? 1;
  return computeFinancialPeriod(date, startDay);
}

export function computeFinancialPeriod(date: Date, startDay: number): FinancialPeriod {
  const day = date.getDate();
  const start = new Date(date.getFullYear(), date.getMonth(), startDay);
  if (day < startDay) start.setMonth(start.getMonth() - 1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  return {
    startISO: toISODate(start),
    endISO: toISODate(end),
    startDay,
  };
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
