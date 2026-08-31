import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { UpdateDebtCommand } from './update-debt.command';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { DebtResponseMapper } from '../../mappers/debt-response.mapper';
import { DebtFeeService } from '../../services/debt-fee.service';

@CommandHandler(UpdateDebtCommand)
export class UpdateDebtHandler implements ICommandHandler<UpdateDebtCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
    private readonly debtFee: DebtFeeService,
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
    const { totalAmount, feeAmount, ...rest } = command.data;
    debt.update(rest);
    if (totalAmount !== undefined) debt.changeTotalAmount(totalAmount);
    // Сначала деньги, потом долг: оборвётся на комиссии — долг останется
    // прежним, и повтор доведёт правку до конца.
    if (feeAmount !== undefined) await this.debtFee.apply(debt, feeAmount);
    const savedDebt = await this.debtRepository.save(debt);

    return DebtResponseMapper.toResponse(savedDebt);
  }
}
