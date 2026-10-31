import type { Account } from '../aggregates/account';
import type { Transaction } from '../aggregates/transaction';

/** Поля строки, от которых зависит её влияние на остатки. */
export interface BalanceAffectingRow {
  type: string;
  accountId: string;
  amount: number;
  currency: string;
  isDebtRelated: boolean;
  toAccountId: string | null;
  toAmount: number | null;
  toCurrency: string | null;
}

/** Сдвиг остатка одного счёта в одной валюте. */
export interface BalanceEffect {
  accountId: string;
  currency: string;
  delta: number;
}

/**
 * Balance Calculation Domain Service
 * Handles balance calculations and adjustments
 */
export class BalanceCalculationService {
  /**
   * Apply a transaction's effect on an account balance
   */
  static applyTransaction(account: Account, transaction: Transaction): void {
    BalanceCalculationService.move(account, transaction, 1);
  }

  /**
   * Направление денег по счёту у операции без второго счёта: 1 — зачисление, −1 — списание.
   * У корректировки `isDebtRelated` значит «минус».
   */
  static nonTransferDirection(type: string, isDebtRelated: boolean): 1 | -1 | 0 {
    if (type === 'income') return 1;
    if (type === 'expense') return -1;
    if (type === 'adjustment') return isDebtRelated ? -1 : 1;
    return 0;
  }

  /**
   * Как проведённая строка двигает остатки: свой счёт — по направлению, у перевода получатель
   * ещё и получает сумму прихода. Та же арифметика, что у `applyTransaction` + `applyTransferReceive`.
   */
  static balanceEffects(row: BalanceAffectingRow): BalanceEffect[] {
    const effects: BalanceEffect[] = [
      {
        accountId: row.accountId,
        currency: row.currency,
        delta: BalanceCalculationService.sourceDirection(row.type, row.isDebtRelated) * row.amount,
      },
    ];
    if (
      row.type === 'transfer' &&
      row.toAccountId !== null &&
      row.toAmount !== null &&
      row.toCurrency !== null
    ) {
      effects.push({ accountId: row.toAccountId, currency: row.toCurrency, delta: row.toAmount });
    }
    return effects;
  }

  /** Направление по счёту `accountId` строки: перевод для своего счёта-источника — списание. */
  private static sourceDirection(type: string, isDebtRelated: boolean): 1 | -1 | 0 {
    return type === 'transfer'
      ? -1
      : BalanceCalculationService.nonTransferDirection(type, isDebtRelated);
  }

  /** Деньги по счёту-источнику: `sign` 1 — провести операцию, −1 — развернуть. */
  private static move(account: Account, transaction: Transaction, sign: 1 | -1): void {
    const direction = BalanceCalculationService.sourceDirection(
      transaction.type.value,
      transaction.isDebtRelated,
    );
    account.applyDelta(direction * sign * transaction.amountValue, transaction.currency);
  }

  /**
   * Apply the receiving side of a transfer
   */
  static applyTransferReceive(account: Account, transaction: Transaction): void {
    if (!transaction.type.isTransfer() || !transaction.toAmount) {
      throw new Error('Transaction is not a transfer or missing toAmount');
    }

    account.credit(transaction.toAmountValue!, transaction.toCurrency!);
  }

  /**
   * Reverse a transaction's effect on an account balance
   */
  static reverseTransaction(account: Account, transaction: Transaction): void {
    BalanceCalculationService.move(account, transaction, -1);
  }

  /**
   * Reverse the receiving side of a transfer
   */
  static reverseTransferReceive(account: Account, transaction: Transaction): void {
    if (!transaction.type.isTransfer() || !transaction.toAmount) {
      throw new Error('Transaction is not a transfer or missing toAmount');
    }

    account.debit(transaction.toAmountValue!, transaction.toCurrency!);
  }

  /**
   * Calculate the net effect of a transaction update
   */
  static calculateUpdateDelta(
    oldTransaction: Transaction,
    newData: { amount?: number; currency?: string; type?: string },
  ): { oldEffect: number; newEffect: number; currency: string } {
    const oldType = oldTransaction.type.value;
    const newType = newData.type ?? oldType;
    const oldAmount = oldTransaction.amountValue;
    const newAmount = newData.amount ?? oldAmount;
    const currency = newData.currency ?? oldTransaction.currency;

    // Calculate effects (positive for credit, negative for debit)
    const getEffect = (type: string, amount: number) => {
      if (type === 'income') return amount;
      if (type === 'expense') return -amount;
      return 0; // transfers handled separately
    };

    return {
      oldEffect: getEffect(oldType, oldAmount),
      newEffect: getEffect(newType, newAmount),
      currency,
    };
  }
}
