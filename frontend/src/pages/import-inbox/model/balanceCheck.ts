import type { ImportedTransaction } from '@/entities/imported-transaction';

export interface BalanceCheck {
  /** Каким станет баланс в приложении после подтверждения этого импорта */
  expected: number;
  /** Совпадает ли ожидаемый баланс с balance_after из банковского уведомления */
  matches: boolean;
}

/**
 * Сверка с банком до подтверждения: если (баланс_в_приложении ± сумма) равен
 * balance_after из уведомления — после подтверждения балансы сойдутся.
 */
export function checkBalanceAfter(
  appBalance: number,
  item: Pick<ImportedTransaction, 'type' | 'amount' | 'balance_after'>,
): BalanceCheck | null {
  if (item.balance_after === null || item.amount === null) return null;
  const signed =
    item.type === 'income'
      ? Math.abs(item.amount)
      : item.type === 'expense'
        ? -Math.abs(item.amount)
        : item.amount; // balance_change: дельта уже подписана
  const expected = appBalance + signed;
  // Допуск на плавающую точку (суммы в минорных единицах не хранятся)
  return { expected, matches: Math.abs(expected - item.balance_after) < 0.005 };
}
