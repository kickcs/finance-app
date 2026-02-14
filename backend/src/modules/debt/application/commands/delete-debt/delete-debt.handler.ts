import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeleteDebtCommand } from './delete-debt.command';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';

@CommandHandler(DeleteDebtCommand)
export class DeleteDebtHandler implements ICommandHandler<DeleteDebtCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
  ) {}

  async execute(command: DeleteDebtCommand): Promise<void> {
    const debt = await this.debtRepository.findById(command.id);
    if (!debt) {
      throw new NotFoundException('Debt not found');
    }
    if (debt.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }
    await this.debtRepository.delete(command.id);
  }
}
