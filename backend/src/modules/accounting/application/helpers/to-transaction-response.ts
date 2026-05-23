import { type Transaction } from '../../domain/aggregates/transaction';

export function toTransactionResponse(transaction: Transaction) {
  return {
    id: transaction.id,
    userId: transaction.userId,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    amount: transaction.amountValue,
    currency: transaction.currency,
    type: transaction.typeValue,
    description: transaction.description,
    date: transaction.date,
    isDebtRelated: transaction.isDebtRelated,
    isInformational: transaction.isInformational,
    debtId: transaction.debtId,
    toAccountId: transaction.toAccountId,
    toAmount: transaction.toAmountValue,
    toCurrency: transaction.toCurrency,
    createdAt: transaction.createdAt,
  };
}
