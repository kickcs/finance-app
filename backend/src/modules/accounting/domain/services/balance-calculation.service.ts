import type { Account } from '../aggregates/account';
import type { Transaction } from '../aggregates/transaction';

/**
 * Balance Calculation Domain Service
 * Handles balance calculations and adjustments
 */
export class BalanceCalculationService {
  /**
   * Apply a transaction's effect on an account balance
   */
  static applyTransaction(account: Account, transaction: Transaction): void {
    const type = transaction.type.value;
    const amount = transaction.amountValue;
    const currency = transaction.currency;

    if (type === 'income') {
      account.credit(amount, currency);
    } else if (type === 'expense') {
      account.debit(amount, currency);
    } else if (type === 'transfer') {
      // For transfers, this handles the source account (debit)
      account.debit(amount, currency);
    }
  }

  /**
   * Apply the receiving side of a transfer
   */
  static applyTransferReceive(
    account: Account,
    transaction: Transaction,
  ): void {
    if (!transaction.type.isTransfer() || !transaction.toAmount) {
      throw new Error('Transaction is not a transfer or missing toAmount');
    }

    account.credit(transaction.toAmountValue!, transaction.toCurrency!);
  }

  /**
   * Reverse a transaction's effect on an account balance
   */
  static reverseTransaction(account: Account, transaction: Transaction): void {
    const type = transaction.type.value;
    const amount = transaction.amountValue;
    const currency = transaction.currency;

    if (type === 'income') {
      account.debit(amount, currency);
    } else if (type === 'expense') {
      account.credit(amount, currency);
    } else if (type === 'transfer') {
      // For transfers, this reverses the source account (credit back)
      account.credit(amount, currency);
    }
  }

  /**
   * Reverse the receiving side of a transfer
   */
  static reverseTransferReceive(
    account: Account,
    transaction: Transaction,
  ): void {
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
