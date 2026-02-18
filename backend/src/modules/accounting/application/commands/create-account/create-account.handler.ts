import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateAccountCommand } from './create-account.command';
import { Account } from '../../../domain/aggregates/account';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { toAccountResponse } from '../../shared/account-response.helper';

@CommandHandler(CreateAccountCommand)
export class CreateAccountHandler
  implements ICommandHandler<CreateAccountCommand>
{
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
      command.typeFields,
    );

    const savedAccount = await this.accountRepository.save(account);
    await this.eventPublisher.publishEvents(account);

    return toAccountResponse(savedAccount);
  }
}
