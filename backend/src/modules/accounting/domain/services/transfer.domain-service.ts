import { Account } from '../aggregates/account';
import { Transaction } from '../aggregates/transaction';

export interface TransferParams {
  id: string;
  userId: string;
  fromAccount: Account;
  toAccount: Account;
  categoryId: string;
  fromAmount: number;
  fromCurrency: string;
  toAmount: number;
  toCurrency: string;
  date: Date;
  description?: string;
}

/**
 * Transfer Domain Service
 * Handles the domain logic for transfers between accounts
 */
export class TransferDomainService {
  /**
   * Execute a transfer between two accounts
   * Returns the created transaction and updates the accounts
   */
  static executeTransfer(params: TransferParams): Transaction {
    const {
      id,
      userId,
      fromAccount,
      toAccount,
      categoryId,
      fromAmount,
      fromCurrency,
      toAmount,
      toCurrency,
      date,
      description,
    } = params;

    // Validate accounts belong to the same user
    if (fromAccount.userId !== userId || toAccount.userId !== userId) {
      throw new Error('Both accounts must belong to the same user');
    }

    // Validate not transferring to same account
    if (fromAccount.id === toAccount.id) {
      throw new Error('Cannot transfer to the same account');
    }

    // Debit from source account
    fromAccount.debit(fromAmount, fromCurrency);

    // Credit to destination account
    toAccount.credit(toAmount, toCurrency);

    // Create transfer transaction
    const transaction = Transaction.createTransfer(
      id,
      userId,
      fromAccount.id,
      toAccount.id,
      categoryId,
      fromAmount,
      fromCurrency,
      toAmount,
      toCurrency,
      date,
      description,
    );

    return transaction;
  }

  /**
   * Reverse a transfer (for deletion or update)
   */
  static reverseTransfer(
    fromAccount: Account,
    toAccount: Account,
    fromAmount: number,
    fromCurrency: string,
    toAmount: number,
    toCurrency: string,
  ): void {
    // Reverse the debit (credit back to source)
    fromAccount.credit(fromAmount, fromCurrency);

    // Reverse the credit (debit from destination)
    toAccount.debit(toAmount, toCurrency);
  }
}
