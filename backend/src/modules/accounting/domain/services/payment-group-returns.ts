export interface PaymentPartReturns {
  amount: number;
  /** Возвраты по долгам, указывающим на эту часть. */
  returned: number;
}

/**
 * Доля возвратов группы на части `part`: свои возвраты плюс излишек пары, но не больше суммы части.
 * Так net каждой части ≥ 0, а сумма net двух частей = итог − возвраты группы.
 */
export function paymentPartReturnedAmount(
  part: PaymentPartReturns,
  sibling: PaymentPartReturns,
): number {
  const overflow = Math.max(0, roundCents(sibling.returned - sibling.amount));
  return Math.min(part.amount, roundCents(part.returned + overflow));
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
