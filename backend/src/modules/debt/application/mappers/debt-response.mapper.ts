import type { Debt } from '../../domain/aggregates/debt';

export interface DebtResponseDto {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  monthlyPayment: number | null;
  nextPaymentDate: string | null;
  debtType: 'given' | 'taken';
  personName: string | null;
  accountId: string | null;
  transactionId: string | null;
  closeTransactionId: string | null;
  isClosed: boolean;
  currency: string;
  sourceTransactionId: string | null;
  createdAt: string;
  description: string | null;
  closedAt: string | null;
  forgivenAmount: number;
  isPrivate: boolean;
}

export class DebtResponseMapper {
  static toResponse(debt: Debt): DebtResponseDto {
    return {
      id: debt.id,
      userId: debt.userId,
      name: debt.name,
      totalAmount: debt.totalAmountValue,
      remainingAmount: debt.remainingAmountValue,
      monthlyPayment: debt.monthlyPaymentValue,
      nextPaymentDate: debt.nextPaymentDate?.toISOString() ?? null,
      debtType: debt.debtTypeValue,
      personName: debt.personName,
      accountId: debt.accountId,
      transactionId: debt.transactionId,
      closeTransactionId: debt.closeTransactionId,
      isClosed: debt.isClosed,
      currency: debt.currency,
      sourceTransactionId: debt.sourceTransactionId,
      createdAt: debt.createdAt.toISOString(),
      description: debt.description,
      closedAt: debt.closedAt?.toISOString() ?? null,
      forgivenAmount: debt.forgivenAmount,
      isPrivate: debt.isPrivate,
    };
  }

  static toResponseList(debts: Debt[]) {
    return debts.map((debt) => DebtResponseMapper.toResponse(debt));
  }
}
