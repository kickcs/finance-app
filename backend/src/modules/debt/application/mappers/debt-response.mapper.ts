import type { Debt } from '../../domain/aggregates/debt';

export class DebtResponseMapper {
  static toResponse(debt: Debt) {
    return {
      id: debt.id,
      userId: debt.userId,
      name: debt.name,
      totalAmount: debt.totalAmountValue,
      remainingAmount: debt.remainingAmountValue,
      monthlyPayment: debt.monthlyPaymentValue,
      nextPaymentDate: debt.nextPaymentDate,
      debtType: debt.debtTypeValue,
      personName: debt.personName,
      accountId: debt.accountId,
      transactionId: debt.transactionId,
      closeTransactionId: debt.closeTransactionId,
      isClosed: debt.isClosed,
      currency: debt.currency,
      sourceTransactionId: debt.sourceTransactionId,
      createdAt: debt.createdAt,
      description: debt.description,
      closedAt: debt.closedAt?.toISOString() ?? null,
      forgivenAmount: debt.forgivenAmount,
    };
  }

  static toResponseList(debts: Debt[]) {
    return debts.map((debt) => DebtResponseMapper.toResponse(debt));
  }
}
