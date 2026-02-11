import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateAccountCommand } from './update-account.command';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';

@CommandHandler(UpdateAccountCommand)
export class UpdateAccountHandler implements ICommandHandler<UpdateAccountCommand> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(command: UpdateAccountCommand) {
    const account = await this.accountRepository.findById(command.id);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    account.update(command.data);

    const savedAccount = await this.accountRepository.save(account);

    return {
      id: savedAccount.id,
      userId: savedAccount.userId,
      name: savedAccount.name,
      icon: savedAccount.icon,
      color: savedAccount.color,
      type: savedAccount.typeValue,
      order: savedAccount.order,
      createdAt: savedAccount.createdAt,
    };
  }
}
