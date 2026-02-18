import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UpdateAccountCommand } from './update-account.command';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { toAccountResponse } from '../../shared/account-response.helper';

@CommandHandler(UpdateAccountCommand)
export class UpdateAccountHandler
  implements ICommandHandler<UpdateAccountCommand>
{
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(command: UpdateAccountCommand) {
    const account = await this.accountRepository.findById(command.id);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }

    account.update(command.data);

    const savedAccount = await this.accountRepository.save(account);

    return toAccountResponse(savedAccount);
  }
}
