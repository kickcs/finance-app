import type { Debt } from '@/shared/api/database.types';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import { sortDebtsByDateAsc } from './sortDebts';

/** Деньги хранятся с двумя знаками, иначе копейка зависает. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface MutualSettlement {
  /** Чья сторона переживёт зачёт — её и закрывает платёж. */
  direction: 'given' | 'taken';
  /** Сколько гасится зачётом с каждой стороны; 0 — встречных долгов нет. */
  offsetAmount: number;
  /** Доля зачёта по каждому долгу. */
  offsetById: Map<string, number>;
  /** Что останется после зачёта. */
  net: number;
}

export function hasBothDirections(debts: Debt[]): boolean {
  return debts.some((d) => d.debt_type === 'given') && debts.some((d) => d.debt_type === 'taken');
}

/** Зачёт идёт у одного человека внутри одной валюты — только так встречные долги сводятся одним расчётом. */
export function canSettleTogether(debts: Debt[]): boolean {
  if (!hasBothDirections(debts)) return true;
  const sameCurrency = new Set(debts.map((d) => d.currency || DEFAULT_CURRENCY)).size === 1;
  return sameCurrency && new Set(debts.map((d) => d.person_name)).size === 1;
}

/** Предпросмотр серверного зачёта, чтобы шторка показала то, что он и проведёт. */
export function planMutualSettlement(debts: Debt[]): MutualSettlement {
  const sideTotal = (type: 'given' | 'taken') =>
    round2(debts.filter((d) => d.debt_type === type).reduce((s, d) => s + d.remaining_amount, 0));
  const given = sideTotal('given');
  const taken = sideTotal('taken');
  const offsetAmount = Math.min(given, taken);

  // Каждая сторона гасит одну и ту же сумму, старые долги первыми.
  const offsetLeft = { given: offsetAmount, taken: offsetAmount };
  const offsetById = new Map<string, number>();
  for (const debt of sortDebtsByDateAsc(debts)) {
    const part = round2(Math.min(offsetLeft[debt.debt_type], debt.remaining_amount));
    if (part <= 0) continue;
    offsetById.set(debt.id, part);
    offsetLeft[debt.debt_type] = round2(offsetLeft[debt.debt_type] - part);
  }

  return {
    direction: given >= taken ? 'given' : 'taken',
    offsetAmount,
    offsetById,
    net: Math.abs(round2(given - taken)),
  };
}

/** Остаток долга после зачёта — то, что закрывается платежом. */
export function remainingAfterOffset(settlement: MutualSettlement, debt: Debt): number {
  return round2(debt.remaining_amount - (settlement.offsetById.get(debt.id) ?? 0));
}
