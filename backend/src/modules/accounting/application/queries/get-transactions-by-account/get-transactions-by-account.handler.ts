import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, ForbiddenException } from '@nestjs/common';
import { GetTransactionsByAccountQuery } from './get-transactions-by-account.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';

@QueryHandler(GetTransactionsByAccountQuery)
export class GetTransactionsByAccountHandler implements IQueryHandler<GetTransactionsByAccountQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(query: GetTransactionsByAccountQuery) {
    const account = await this.accountRepository.findById(query.accountId);
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- explicit null check for security
    if (!account || account.userId !== query.userId) {
      throw new ForbiddenException('Access denied');
    }

    const transactions = await this.transactionRepository.findByAccountId(query.accountId);

    return transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      accountId: t.accountId,
      categoryId: t.categoryId,
      amount: t.amountValue,
      currency: t.currency,
      type: t.typeValue,
      description: t.description,
      date: t.date,
      isDebtRelated: t.isDebtRelated,
      isInformational: t.isInformational,
      debtId: t.debtId,
      toAccountId: t.toAccountId,
      toAmount: t.toAmountValue,
      toCurrency: t.toCurrency,
      createdAt: t.createdAt,
    }));
  }
}
