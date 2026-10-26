import type { CloseAllPreview } from '@/entities/debt';
import type { Debt } from '@/shared/api/database.types';
import { sortDebtsByDateAsc } from './sortDebts';

export type DistributionStatus =
  | 'offset'
  | 'closed'
  | 'forgiven'
  | 'paidAndForgiven'
  | 'partial'
  | 'open';

export interface DistributionRow {
  debt: Debt;
  /** Сколько долга гасится: зачётом и деньгами. */
  covered: number;
  forgiven: number;
  status: DistributionStatus;
}

/** Деньги хранятся с двумя знаками, иначе копейка зависает. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Строки шторки из ответа предпросмотра: что достанется каждому долгу, считал
 * сервер. Здесь только раскладка по долгам; порядок — старые первыми, как и платит сервер.
 */
export function buildDistribution(debts: Debt[], preview: CloseAllPreview): DistributionRow[] {
  const offsetById = new Map(preview.offset_parts.map((p) => [p.debt_id, p.amount]));
  const paymentById = new Map(preview.payments.map((p) => [p.debt_id, p]));

  return sortDebtsByDateAsc(debts).map((debt) => {
    const offset = offsetById.get(debt.id) ?? 0;
    const left = round2(debt.remaining_amount - offset);
    const payment = paymentById.get(debt.id);
    // Переплата приписана платежу, но долгу не засчитывается.
    const allocated = payment ? Math.min(payment.amount, left) : 0;
    const forgiven = payment?.forgive ? round2(left - allocated) : 0;

    return {
      debt,
      covered: round2(offset + allocated),
      forgiven,
      status: statusOf(left, allocated, payment?.forgive ?? false, payment !== undefined),
    };
  });
}

function statusOf(
  left: number,
  allocated: number,
  forgive: boolean,
  hasPayment: boolean,
): DistributionStatus {
  if (left <= 0) return 'offset';
  if (!hasPayment) return 'open';
  if (allocated >= left) return 'closed';
  // Часть уходит со счёта, часть списывается: назвать это просто «Простится»
  // значило бы спрятать реальное списание денег.
  if (forgive) return allocated > 0 ? 'paidAndForgiven' : 'forgiven';
  return 'partial';
}
