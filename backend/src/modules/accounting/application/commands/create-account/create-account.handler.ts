import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateAccountCommand } from './create-account.command';
import { Account } from '../../../domain/aggregates/account';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';

@CommandHandler(CreateAccountCommand)
export class CreateAccountHandler implements ICommandHandler<CreateAccountCommand> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CreateAccountCommand) {
    const account = Account.create(
      crypto.randomUUID(),
      command.userId,
      command.name,
      command.icon,
      command.color,
      command.type,
      command.order,
      command.balances,
    );

    const savedAccount = await this.accountRepository.save(account);
    await this.eventPublisher.publishEvents(account);

    return this.toResponse(savedAccount);
  }

  private toResponse(account: Account) {
    return {
      id: account.id,
      userId: account.userId,
      name: account.name,
      icon: account.icon,
      color: account.color,
      type: account.typeValue,
      order: account.order,
      balances: account.balances.map((b) => ({
        id: b.id,
        currency: b.currencyCode,
        balance: b.balanceAmount,
      })),
      createdAt: account.createdAt,
    };
  }
}
