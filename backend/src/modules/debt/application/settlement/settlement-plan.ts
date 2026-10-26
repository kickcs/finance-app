import { BadRequestException } from '@nestjs/common';
import { ALL_DEBT_CATEGORY_IDS } from '../../../accounting/domain/constants/default-categories';

/** Деньги хранятся с двумя знаками — остатки округляем так же, иначе копейка зависает. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Как долг называется в описаниях записей и в сообщениях: человек, а без него — имя долга. */
export function displayName(debt: { personName: string | null; name: string }): string {
  return debt.personName?.trim() || debt.name.trim();
}

export interface SettlementDebt {
  id: string;
  debtType: 'given' | 'taken';
  remaining: number;
  createdAt: Date;
}

/** Старые первыми; при равном createdAt решает id — иначе сервер и предпросмотр разойдутся. */
function sortOldestFirst(debts: readonly SettlementDebt[]): SettlementDebt[] {
  return [...debts].sort((a, b) => {
    const byDate = a.createdAt.getTime() - b.createdAt.getTime();
    if (byDate !== 0) return byDate;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export interface PaymentPlan {
  /** Сколько реально гасит долг: сумма платежа без переплаты. */
  actualPayment: number;
  excess: number;
  remainderAfter: number;
  /** Сколько прощается: остаток, если пользователь его прощает. */
  forgiven: number;
  willClose: boolean;
}

export function planPayment(input: {
  remaining: number;
  amount: number;
  forgiveRemainder: boolean;
  settleWithWork: boolean;
  excessCategoryId?: string;
  workCategoryId?: string;
}): PaymentPlan {
  const { remaining, amount, forgiveRemainder, settleWithWork, excessCategoryId, workCategoryId } =
    input;

  if (amount < 0) throw new BadRequestException('Некорректная сумма платежа');
  if (amount === 0 && !forgiveRemainder) {
    throw new BadRequestException('Некорректная сумма платежа');
  }

  // Math.max убирает -0 и отрицательный хвост округления: переплата и остаток не бывают < 0.
  const excess = Math.max(0, round2(amount - remaining));
  if (excess > 0 && !excessCategoryId) {
    throw new BadRequestException('Выберите категорию для переплаты');
  }
  // Отработка гасит ровно то, что человек должен: «переработки» здесь нет —
  // лишние деньги можно записать доходом, лишний труд записывать некуда.
  if (settleWithWork && excess > 0) {
    throw new BadRequestException('Отработка не может превышать остаток долга');
  }
  // Категория работы — обычная категория пользователя. Долговая на её месте
  // сломала бы аналитику: возврат посчитался бы дважды.
  if (workCategoryId && ALL_DEBT_CATEGORY_IDS.includes(workCategoryId)) {
    throw new BadRequestException('Некорректная категория работы');
  }

  const actualPayment = round2(Math.min(amount, remaining));
  const remainderAfter = Math.max(0, round2(remaining - actualPayment));
  const willClose = excess > 0 || forgiveRemainder || remainderAfter <= 0;

  return {
    actualPayment,
    excess,
    remainderAfter,
    forgiven: forgiveRemainder ? remainderAfter : 0,
    willClose,
  };
}

export interface OffsetPlan {
  /** Сколько гасится с каждой стороны. 0 — встречных долгов нет. */
  offsetAmount: number;
  /** Чья сторона переживёт зачёт; при равных сторонах — 'given'. */
  direction: 'given' | 'taken';
  /** Что останется на уцелевшей стороне. */
  net: number;
  /** Доли по долгам: сначала given, затем taken, внутри стороны — старые первыми. */
  parts: { debtId: string; amount: number }[];
}

/** Гасит `pool` по долгам одной стороны, начиная с самых старых. */
function allocateSide(
  sorted: readonly SettlementDebt[],
  type: 'given' | 'taken',
  pool: number,
): OffsetPlan['parts'] {
  const parts: OffsetPlan['parts'] = [];
  let left = pool;

  for (const debt of sorted) {
    if (debt.debtType !== type) continue;
    if (left <= 0) break;
    const amount = round2(Math.min(left, debt.remaining));
    if (amount <= 0) continue;
    parts.push({ debtId: debt.id, amount });
    left = round2(left - amount);
  }

  return parts;
}

/** Зачёт всегда идёт на максимум (`min` двух сторон), обе стороны гасят одну и ту же сумму. */
export function planOffset(debts: SettlementDebt[]): OffsetPlan {
  const sorted = sortOldestFirst(debts);
  const sideTotal = (type: 'given' | 'taken') =>
    round2(sorted.filter((d) => d.debtType === type).reduce((sum, d) => sum + d.remaining, 0));

  const given = sideTotal('given');
  const taken = sideTotal('taken');
  const offsetAmount = Math.min(given, taken);

  return {
    offsetAmount,
    direction: given >= taken ? 'given' : 'taken',
    net: Math.abs(round2(given - taken)),
    parts: [
      ...allocateSide(sorted, 'given', offsetAmount),
      ...allocateSide(sorted, 'taken', offsetAmount),
    ],
  };
}

export interface CloseAllPayment {
  debtId: string;
  /** С переплатой, если `withExcess`: платёж по `planPayment` получит её как `amount`. */
  amount: number;
  forgive: boolean;
  withExcess: boolean;
}

export interface CloseAllPlan {
  offset: OffsetPlan | null;
  payments: CloseAllPayment[];
  excess: number;
  /** Остаток долгов после зачёта — то, что покрывает платёж. */
  totalDebt: number;
}

/**
 * Зачёт встречных долгов, затем платежи по уцелевшей стороне старыми первыми.
 * Без `paymentAmount` платится весь остаток после зачёта.
 */
export function planCloseAll(
  debts: SettlementDebt[],
  input: { paymentAmount?: number; forgiveRemainder: boolean },
): CloseAllPlan {
  const { paymentAmount, forgiveRemainder } = input;
  if (paymentAmount !== undefined && paymentAmount < 0) {
    throw new BadRequestException('Некорректная сумма платежа');
  }

  const offsetPlan = planOffset(debts);
  const offset = offsetPlan.offsetAmount > 0 ? offsetPlan : null;
  const offsetById = new Map(offsetPlan.parts.map((p) => [p.debtId, p.amount]));

  const survivors = sortOldestFirst(debts)
    .map((d) => ({ id: d.id, remaining: round2(d.remaining - (offsetById.get(d.id) ?? 0)) }))
    .filter((d) => d.remaining > 0);

  const totalDebt = round2(survivors.reduce((sum, d) => sum + d.remaining, 0));
  const budgetTotal = paymentAmount ?? totalDebt;
  // Некому принять переплату — деньги не двигаются, поэтому и переплаты нет.
  const excess = survivors.length > 0 ? Math.max(0, round2(budgetTotal - totalDebt)) : 0;

  let budget = budgetTotal;
  const payments: CloseAllPayment[] = [];
  for (const debt of survivors) {
    const allocated = round2(Math.min(budget, debt.remaining));
    budget = round2(budget - allocated);

    // Долг без доли и без прощения не трогаем.
    if (allocated === 0 && !forgiveRemainder) continue;

    payments.push({
      debtId: debt.id,
      amount: allocated,
      forgive: forgiveRemainder && allocated < debt.remaining,
      withExcess: false,
    });
  }

  // Переплата уходит последнему оплаченному долгу: к нему все прежние уже закрыты полностью.
  if (excess > 0) {
    const last = payments[payments.length - 1];
    last.amount = round2(last.amount + excess);
    last.withExcess = true;
  }

  return { offset, payments, excess, totalDebt };
}
