import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetDebtsQuery } from './get-debts.query';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';

@QueryHandler(GetDebtsQuery)
export class GetDebtsHandler implements IQueryHandler<GetDebtsQuery> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
  ) {}

  async execute(query: GetDebtsQuery) {
    const debts = await this.debtRepository.findByUserId(query.userId);
    return debts.map((debt) => ({
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
    }));
  }
}
