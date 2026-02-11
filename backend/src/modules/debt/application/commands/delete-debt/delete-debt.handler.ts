import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { DeleteDebtCommand } from './delete-debt.command';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';

@CommandHandler(DeleteDebtCommand)
export class DeleteDebtHandler implements ICommandHandler<DeleteDebtCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
  ) {}

  async execute(command: DeleteDebtCommand): Promise<void> {
    const exists = await this.debtRepository.exists(command.id);
    if (!exists) {
      throw new NotFoundException('Debt not found');
    }
    await this.debtRepository.delete(command.id);
  }
}
