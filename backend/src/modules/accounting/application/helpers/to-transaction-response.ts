import { type Transaction } from '../../domain/aggregates/transaction';
import { type ITransactionRepository } from '../../domain/repositories/transaction.repository.interface';

/** `paymentSibling` — вторая часть операции, оплаченной с двух счетов. */
export function toTransactionResponse(
  transaction: Transaction,
  paymentSibling: Transaction | null = null,
) {
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
    paymentGroupId: transaction.paymentGroupId,
    settlementId: transaction.settlementId,
    paymentSibling: paymentSibling
      ? {
          id: paymentSibling.id,
          accountId: paymentSibling.accountId,
          amount: paymentSibling.amountValue,
        }
      : null,
    createdAt: transaction.createdAt,
  };
}

/** Ответы для списка: пары оплат с двух счетов подтягиваются одним запросом. */
export async function toTransactionResponses(
  transactions: Transaction[],
  repository: Pick<ITransactionRepository, 'findPaymentSiblings'>,
) {
  const siblings = await repository.findPaymentSiblings(transactions);
  return transactions.map((t) => toTransactionResponse(t, siblings.get(t.id)));
}
