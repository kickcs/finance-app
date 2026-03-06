import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdjustBalanceCommand } from './adjust-balance.command';
import { Transaction } from '../../../domain/aggregates/transaction';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { toTransactionResponse } from '../../helpers/to-transaction-response';

@CommandHandler(AdjustBalanceCommand)
export class AdjustBalanceHandler implements ICommandHandler<AdjustBalanceCommand> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: AdjustBalanceCommand) {
    const { userId, accountId, targetBalance, currency, date, description } = command;

    const account = await this.accountRepository.findByIdWithBalances(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.userId !== userId) {
      throw new ForbiddenException('Account does not belong to user');
    }

    const currentBalance = account.getBalance(currency)?.balanceAmount ?? 0;
    const diff = targetBalance - currentBalance;

    if (diff === 0) {
      throw new BadRequestException('Balance is already correct');
    }

    const transactionId = crypto.randomUUID();
    const isNegative = diff < 0;
    const absoluteAmount = Math.abs(diff);

    const transaction = Transaction.createAdjustment(
      transactionId,
      userId,
      accountId,
      absoluteAmount,
      currency,
      date,
      isNegative,
      description,
    );

    if (isNegative) {
      account.debit(absoluteAmount, currency);
    } else {
      account.credit(absoluteAmount, currency);
    }

    await this.dataSource.transaction(async () => {
      await this.accountRepository.save(account);
      await this.transactionRepository.save(transaction);
    });

    await this.eventPublisher.publishEvents(account);
    await this.eventPublisher.publishEvents(transaction);

    return toTransactionResponse(transaction);
  }
}
