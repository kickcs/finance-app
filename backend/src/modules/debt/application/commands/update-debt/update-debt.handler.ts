import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { UpdateDebtCommand } from './update-debt.command';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { DebtResponseMapper } from '../../mappers/debt-response.mapper';

@CommandHandler(UpdateDebtCommand)
export class UpdateDebtHandler implements ICommandHandler<UpdateDebtCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
  ) {}

  async execute(command: UpdateDebtCommand) {
    const debt = await this.debtRepository.findById(command.id);
    if (!debt) {
      throw new NotFoundException('Debt not found');
    }

    if (debt.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }

    if (debt.isClosed && command.data.isClosed === true) {
      throw new ConflictException('Debt is already closed');
    }

    debt.update(command.data);
    const savedDebt = await this.debtRepository.save(debt);

    return DebtResponseMapper.toResponse(savedDebt);
  }
}
