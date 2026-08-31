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

    // Направление задаёт категории платежей возврата. Перевернуть долг, по
    // которому уже возвращали, значит развернуть их в обратную сторону.
    if (
      command.data.debtType !== undefined &&
      command.data.debtType !== debt.debtTypeValue &&
      debt.remainingAmountValue !== debt.totalAmountValue
    ) {
      throw new ConflictException('Cannot change the direction of a debt with payments');
    }

    // Сумму двигает агрегат: правка «было 1000, стало 1200» обязана сдвинуть и
    // остаток, иначе долг молча теряет или приобретает возвращённое.
    const { totalAmount, ...rest } = command.data;
    debt.update(rest);
    if (totalAmount !== undefined) debt.changeTotalAmount(totalAmount);
    const savedDebt = await this.debtRepository.save(debt);

    return DebtResponseMapper.toResponse(savedDebt);
  }
}
