/** Вторая часть операции, оплаченной с двух счетов. Счёт может быть ещё не выбран. */
export interface SecondPart {
  accountId: string | null;
  amount: number;
}

export interface PaymentParts {
  total: number;
  primaryAmount: number;
  secondAmount: number;
}

export interface ResolvePartsInput {
  /** `total` — итог задан пользователем; `primary` — первая часть закреплена (банк), итог растёт. */
  anchor: 'total' | 'primary';
  total: number;
  primaryFixed?: number;
  secondAmount: number;
}

// Суммы в валютах с копейками: 0.3 − 0.1 в float даёт 0.19999999999999998.
const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function resolveParts({
  anchor,
  total,
  primaryFixed = 0,
  secondAmount,
}: ResolvePartsInput): PaymentParts {
  if (anchor === 'primary') {
    return {
      total: roundMoney(primaryFixed + secondAmount),
      primaryAmount: primaryFixed,
      secondAmount,
    };
  }
  return { total, primaryAmount: roundMoney(total - secondAmount), secondAmount };
}

/** Сообщение об ошибке для пользователя или `null`, если вторая часть корректна. */
export function validateSecondPart({
  total,
  primaryAccountId,
  secondPart,
}: {
  total: number;
  primaryAccountId: string | null;
  secondPart: SecondPart;
}): string | null {
  if (!secondPart.accountId) return 'Выберите второй счёт';
  if (secondPart.accountId === primaryAccountId) return 'Второй счёт должен отличаться от первого';
  if (!(secondPart.amount > 0)) return 'Введите сумму второй части';
  if (secondPart.amount >= total) return 'Вторая часть должна быть меньше суммы операции';
  return null;
}

/** Поля тела `create`: первая часть уходит в `amount`, вторая — в `second_part`. */
export function buildSecondPartPayload(
  total: number,
  secondPart: SecondPart | null,
): { amount: number; second_part?: { account_id: string; amount: number } } {
  if (!secondPart) return { amount: total };
  if (!secondPart.accountId) throw new Error('Вторая часть оплаты без счёта');
  return {
    amount: resolveParts({ anchor: 'total', total, secondAmount: secondPart.amount }).primaryAmount,
    second_part: { account_id: secondPart.accountId, amount: secondPart.amount },
  };
}
